importScripts('lib.js');

const REMIND_EVERY_MS = 12 * 3600e3; // pengingat ulang kalau masih ada tugas yang belum selesai

function scheduleCheck() {
  chrome.alarms.create('check', { delayInMinutes: 1, periodInMinutes: 60 });
  chrome.alarms.create('ping', { delayInMinutes: 1, periodInMinutes: 5 });
}
chrome.runtime.onInstalled.addListener(async () => {
  scheduleCheck();
  // Versi lama menyimpan key tanpa penanda hasApiKey; panel hanya membaca penanda, bukan key-nya.
  const { apiKey } = await chrome.storage.local.get('apiKey');
  chrome.storage.local.set({ hasApiKey: Boolean(apiKey) });
});
chrome.runtime.onStartup.addListener(scheduleCheck); // alarm bisa hilang saat Chrome restart
chrome.alarms.onAlarm.addListener((a) => (a.name === 'ping' ? pingServer() : checkForums()));

// Token baru (login ulang) langsung memicu pengecekan.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.token?.newValue) checkForums();
});

// UI ada di dalam halaman Mentari, jadi ikon toolbar cukup membuka Mentari.
chrome.action.onClicked.addListener(() => openMentari(BASE_URL));

chrome.notifications.onClicked.addListener(async (id) => {
  const { pending = [] } = await chrome.storage.local.get('pending');
  openMentari(id === 'forum' ? pending[0]?.url : BASE_URL);
});

// Pesan hanya diterima dari bagian extension ini sendiri: halaman options, atau content script di Mentari.
function trustedSender(sender) {
  if (sender.id !== chrome.runtime.id) return false;
  return Boolean(sender.url?.startsWith(chrome.runtime.getURL(''))) || isMentariUrl(sender.url);
}

const str = (v, max) => typeof v === 'string' && v.length <= max;
const validQuestions = (qs) => Array.isArray(qs) && qs.length > 0 && qs.length <= 50 && qs.every((q) =>
  Number.isInteger(q?.no) && str(q.soal, 5000) && Array.isArray(q.pilihan) && q.pilihan.length <= 10 && q.pilihan.every((p) => str(p, 2000)));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!trustedSender(sender) || typeof msg?.type !== 'string') return false;
  const fail = (e) => reply({ error: e.message });
  switch (msg.type) {
    case 'check':
      Promise.all([checkForums(), pingServer(true)]).then(() => reply(true));
      return true;
    case 'ping':
      pingServer(msg.force === true).then(() => reply(true));
      return true;
    case 'openOptions':
      chrome.runtime.openOptionsPage().then(() => reply(true), fail);
      return true;
    case 'askQuiz':
      if (!validQuestions(msg.questions) || !str(msg.title ?? '', 500)) return reply({ error: 'Data soal tidak valid.' }), false;
      askGemini({ system: QUIZ_SYSTEM, prompt: buildQuizPrompt(msg.questions, msg.title), schema: QUIZ_SCHEMA, parse: parseAnswers }).then(reply, fail);
      return true;
    case 'askForum':
      if (!str(msg.question, 20000) || !str(msg.title ?? '', 500) || !isSafeId(msg.kodeCourse) || !isSafeId(msg.forumId)) {
        return reply({ error: 'Data forum tidak valid.' }), false;
      }
      forumHelp(msg).then(reply, fail);
      return true;
    default:
      return false;
  }
});

// Hanya membuka URL Mentari (nilai dari storage tidak dipercaya begitu saja).
const openMentari = (url) => chrome.tabs.create({ url: isMentariUrl(url) ? url : BASE_URL });

async function api(path, token) {
  const r = await fetch(BASE_URL + path, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
  if (r.status === 401 || r.status === 403) throw new Error('AUTH');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Cek beban server: satu request ringan, ukur status dan waktu respons.
let lastPingAt = 0;
async function pingServer(force = false) {
  if (!force && Date.now() - lastPingAt < 60e3) return; // banyak tab Mentari tidak memicu ping beruntun
  const t0 = (lastPingAt = Date.now());
  const { token, server: prev } = await chrome.storage.local.get(['token', 'server']);
  let status = 0;
  try {
    const r = await fetch(BASE_URL + '/api/user-course?page=1&limit=1', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      signal: AbortSignal.timeout(20000),
    });
    status = r.status;
  } catch {
    // timeout / gagal terhubung: status tetap 0
  }
  const server = { ...serverStatus({ status, ms: Date.now() - t0 }), at: Date.now() };
  await chrome.storage.local.set({ server });
  if ((prev?.level || 'ok') !== server.level) {
    chrome.notifications.create('server', {
      type: 'basic',
      iconUrl: 'icon128.png',
      title: server.level === 'ok' ? 'Server Mentari sudah normal' : 'Peringatan server Mentari',
      message: server.text,
    });
  }
}

async function checkForums() {
  const { token, notified = [], lastNotifyAt = 0 } = await chrome.storage.local.get(['token', 'notified', 'lastNotifyAt']);
  if (!token) {
    await chrome.storage.local.set({ error: 'Buka mentari.unpam.ac.id lalu login, supaya extension bisa membaca data kamu.' });
    return chrome.action.setBadgeText({ text: '!' });
  }
  try {
    const list = await api('/api/user-course?page=1&limit=50', token);
    const courses = await Promise.all((list.data || []).filter((c) => isSafeId(c.kode_course))
      .map((c) => api('/api/user-course/' + encodeURIComponent(c.kode_course), token)));
    const pending = courses.flatMap(pendingTasks);
    await chrome.storage.local.set({ pending, classes: classRosters(courses), error: null, checkedAt: Date.now() });
    chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    chrome.action.setBadgeText({ text: pending.length ? String(pending.length) : '' });

    const ids = pending.map((f) => f.id);
    const hasNew = ids.some((id) => !notified.includes(id));
    if (pending.length && (hasNew || Date.now() - lastNotifyAt > REMIND_EVERY_MS)) {
      chrome.notifications.create('forum', {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: `${pending.length} tugas Mentari belum selesai`,
        message: pending.slice(0, 3).map((f) => `${f.course}: ${f.label || 'Forum diskusi'} ${f.section}`).join('\n'),
      });
      await chrome.storage.local.set({ notified: ids, lastNotifyAt: Date.now() });
    }
  } catch (e) {
    const error = e.message === 'AUTH'
      ? 'Sesi Mentari habis. Buka mentari.unpam.ac.id dan login ulang.'
      : `Gagal cek forum (${e.message}). Kemungkinan server sedang penuh, dicoba lagi otomatis.`;
    await chrome.storage.local.set({ error });
    chrome.action.setBadgeText({ text: '!' });
  }
}

// Urutan model. Flash-Lite paling cepat di free tier; 3.8 Flash sering cuma 15-25 token/detik dan timeout.
// Model berikutnya dipakai kalau model sebelumnya lambat, penuh (5xx/429), atau belum tersedia (404).
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
const TIMEOUT_MS = 25000;
const unavailable = new Set(); // model yang 404 untuk key ini, tidak dicoba lagi
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function geminiRequest({ system, prompt, schema, parts = [] }, thinking) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      ...(thinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
    },
  });
}

// Hasil: { result, model }. result = keluaran parse() atas JSON dari model.
async function askGemini(ask) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('Isi Gemini API key dulu: panel Mentari Helper, Pengaturan AI, tombol Atur API key.');
  let lastError = '';
  for (const model of MODELS.filter((m) => !unavailable.has(m))) {
    let thinking = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: geminiRequest(ask, thinking),
          signal: AbortSignal.timeout(ask.timeout || TIMEOUT_MS),
        });
      } catch (e) {
        lastError = e.name === 'TimeoutError' ? `${model} lebih dari ${(ask.timeout || TIMEOUT_MS) / 1000} detik` : `${model}: ${e.message}`;
        break; // lambat atau gagal terhubung: coba model berikutnya
      }
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        try {
          return { result: ask.parse(data.candidates?.[0]?.content?.parts?.find((p) => p.text && !p.thought)?.text), model };
        } catch {
          lastError = `${model} mengirim jawaban tidak lengkap`;
          break;
        }
      }
      lastError = `${model}: ${data.error?.message || 'HTTP ' + r.status}`;
      if (r.status === 400 && thinking && /think/i.test(lastError)) { thinking = false; continue; } // level thinking tidak didukung
      if (r.status === 429 && attempt === 0) { await sleep(3000); continue; }
      if ([400, 401, 403].includes(r.status)) throw new Error('Gemini: ' + lastError); // mis. API key salah: model lain juga akan gagal
      if (r.status === 404) unavailable.add(model);
      break; // 404, 429 berulang, 5xx: coba model berikutnya
    }
  }
  throw new Error(`Gemini sedang lambat atau penuh, coba lagi sebentar lagi. (${lastError})`);
}

// ---------- Forum: pertanyaan dosen + materi pertemuan yang sama ----------
const MATERIAL_TYPES = ['POWER_POINT', 'MATERI_LAINNYA'];

async function forumHelp({ question, title, kodeCourse, forumId }) {
  const materials = await readMaterials(kodeCourse, forumId);
  const parts = materials.flatMap((m) => m.parts);
  const res = await askGemini({
    system: FORUM_SYSTEM,
    prompt: buildForumPrompt(question, title, materials.filter((m) => m.parts.length).map((m) => m.judul)),
    schema: FORUM_SCHEMA,
    parse: parseForumHelp,
    parts,
    timeout: parts.length ? 60000 : TIMEOUT_MS, // membaca materi butuh waktu lebih lama
  });
  return { ...res, materials: materials.map(({ judul, status, ok }) => ({ judul, status, ok })) };
}

// Materi diambil dari section (pertemuan) yang memuat forum ini.
async function readMaterials(kodeCourse, forumId) {
  const { token } = await chrome.storage.local.get('token');
  if (!token || !kodeCourse) return [];
  const course = await api('/api/user-course/' + encodeURIComponent(kodeCourse), token).catch(() => null);
  const section = (course?.data || []).find((s) => (s.sub_section || []).some((x) => String(x.id) === String(forumId)));
  const items = (section?.sub_section || []).filter((x) => MATERIAL_TYPES.includes(x.kode_template) && (x.link || x.file));
  return Promise.all(items.map(async (x) => {
    const judul = x.judul || x.kode_template;
    try {
      return { judul, ok: true, ...(await readMaterial(x, judul, token)) };
    } catch (e) {
      return { judul, ok: false, parts: [], status: e.message };
    }
  }));
}

function base64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function readMaterial(x, judul, token) {
  const url = typeof x.file === 'string' && x.file
    ? `${BASE_URL}/api/file/${x.file.split('/').map(encodeURIComponent).join('/')}`
    : materialUrl(x.link);
  if (!url) throw new Error('link di luar Google Drive/Mentari, buka manual');
  const toMentari = isMentariUrl(url);
  const r = await fetch(url, {
    headers: toMentari ? { Authorization: 'Bearer ' + token } : {},
    credentials: 'omit', // jangan bawa cookie Google/Mentari milik browser
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`gagal diunduh (HTTP ${r.status})`);
  if (Number(r.headers.get('content-length')) > MAX_DOWNLOAD) throw new Error('file lebih dari 30 MB');
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_DOWNLOAD) throw new Error('file lebih dari 30 MB');
  const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) { // %PDF: dibaca langsung oleh Gemini
    if (buf.byteLength > 15e6) throw new Error('PDF lebih dari 15 MB');
    return { parts: [{ text: `Materi "${judul}" (PDF):` }, { inlineData: { mimeType: 'application/pdf', data: base64(buf) } }], status: 'dibaca (PDF)' };
  }
  if (b[0] === 0x50 && b[1] === 0x4b) { // PK: zip, yaitu .pptx/.docx
    const text = (await officeText(buf)).slice(0, 60000);
    if (!text.trim()) throw new Error('tidak ada teks di file');
    return { parts: [{ text: `Materi "${judul}":\n${text}` }], status: 'dibaca' };
  }
  if (b[0] === 0xd0 && b[1] === 0xcf) throw new Error('format .ppt/.doc lama belum didukung');
  throw new Error('tidak bisa diunduh, mungkin perlu izin akses dari dosen');
}
