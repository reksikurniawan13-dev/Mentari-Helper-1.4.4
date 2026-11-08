// Fungsi murni yang dipakai background.js (dan diuji di test.js).
const BASE_URL = 'https://mentari.unpam.ac.id';

// ---------- Keamanan ----------
// Token Mentari hanya boleh dikirim ke origin Mentari yang persis sama
// (startsWith saja akan meloloskan https://mentari.unpam.ac.id.evil.com).
function isMentariUrl(url) {
  try { return new URL(url).origin === BASE_URL; } catch { return false; }
}
// ID/kode dari URL atau pesan: hanya huruf, angka, titik, garis bawah, minus.
const isSafeId = (v) => typeof v === 'string' && /^[\w.-]{1,100}$/.test(v);
const MAX_DOWNLOAD = 30e6; // byte, batas unduhan materi
const MAX_UNZIP = 5e6; // byte per file XML di dalam pptx/docx, cegah zip bomb
const MAX_ZIP_ENTRIES = 2000;

// Tugas per pertemuan yang dipantau, urut seperti di Mentari.
const TASK_TYPES = { PRE_TEST: 'Pretest', FORUM_DISKUSI: 'Forum diskusi', POST_TEST: 'Post test', KUESIONER: 'Kuesioner' };

// Tugas yang belum selesai, hanya dari pertemuan yang forum diskusinya sudah dibuka (punya id dan soalnya
// tersedia). Pretest, post test, dan kuesioner ikut tampil dari pertemuan itu saja. Tugas yang masih
// terkunci tetap tampil beserta catatannya.
const forumOpen = (x) => x.kode_template === 'FORUM_DISKUSI' && x.id && !/belum tersedia/i.test(x.warningAlert || '');

function pendingTasks(course) {
  return (course.data || []).flatMap((section) => {
    const subs = (section.sub_section || []).filter((x) => TASK_TYPES[x.kode_template]);
    if (!subs.some(forumOpen)) return [];
    return subs.flatMap((x) => {
      if (x.completion || /belum tersedia/i.test(x.warningAlert || '')) return [];
      const path = x.kode_template === 'FORUM_DISKUSI' ? x.id && `forum/${x.id}`
        : x.kode_template === 'KUESIONER' ? section.kode_section && `kuesioner/${section.kode_section}`
          : x.id && `exam/${x.id}`;
      if (!path) return [];
      return [{
        id: `${x.kode_template}:${x.kode_template === 'KUESIONER' ? section.kode_section : x.id}`,
        type: x.kode_template,
        label: TASK_TYPES[x.kode_template],
        course: course.coursename || course.kode_course,
        section: section.nama_section || '',
        note: x.warningAlert || '',
        url: `${BASE_URL}/u-courses/${course.kode_course}/${path}`,
      }];
    });
  });
}

// Peserta per kelas. Kode kelas = bagian kedua kode_course, mis. "20261-06SISE001-55201" -> "06SISE001".
function classRosters(courses) {
  const out = {};
  for (const c of courses) {
    if (!Array.isArray(c.peserta)) continue;
    const kelas = String(c.kode_course || '').split('-')[1] || c.kode_course;
    const k = (out[kelas] ||= { courses: 0, members: new Map() });
    k.courses++;
    for (const p of c.peserta) {
      if (p.nim && !k.members.has(String(p.nim))) k.members.set(String(p.nim), { nim: String(p.nim), nama: p.nama_mahasiswa || '' });
    }
  }
  for (const k of Object.values(out)) k.members = [...k.members.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  return out;
}

// Status server dari satu request. status 0 = timeout / tidak bisa terhubung.
const SLOW_MS = 8000;
function serverStatus({ status = 0, ms = 0 }) {
  if (!status) return { level: 'busy', text: 'Server Mentari tidak merespons, kemungkinan sedang penuh atau down.' };
  if (status === 429 || status >= 500) return { level: 'busy', text: `Server Mentari sedang penuh (HTTP ${status}).` };
  if (ms > SLOW_MS) return { level: 'slow', text: `Server Mentari lambat, respons ${(ms / 1000).toFixed(1)} detik.` };
  return { level: 'ok', text: 'Server Mentari normal.' };
}

// ---------- Gemini API key ----------
// AI Studio sekarang membuat key "AQ.Ab..." (ada titik, lebih panjang) selain format lama "AIza...".
// Spasi/baris baru dan tanda kutip ikut tersalin saat menyalin key, jadi dibuang dulu.
function normalizeApiKey(raw) {
  const key = String(raw ?? '').replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
  return /^[A-Za-z0-9][\w.-]{19,1023}$/.test(key) ? key : null;
}

// ---------- Quiz ----------
const QUIZ_SYSTEM =
  'Kamu dosen ahli yang menjawab soal kuis kuliah di Indonesia. Untuk setiap soal: baca teliti, ' +
  'perhatikan kata negasi seperti BUKAN, KECUALI, TIDAK, SALAH; nilai setiap pilihan satu per satu; ' +
  'lalu pilih SATU jawaban yang paling tepat menurut teori baku buku teks mata kuliah tersebut. ' +
  'Tulis alasan singkat satu kalimat sebelum menentukan jawaban. Isi "yakin" dengan jujur: ' +
  'rendah jika soal ambigu, butuh gambar yang tidak terlihat, atau kamu ragu.';

// Structured output: format selalu valid, alasan ditulis dulu supaya model menalar sebelum memilih.
const QUIZ_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      no: { type: 'INTEGER' },
      alasan: { type: 'STRING' },
      jawaban: { type: 'STRING', description: 'huruf pilihan (a, b, c, ...); untuk soal esai tulis jawaban singkat' },
      yakin: { type: 'STRING', enum: ['tinggi', 'sedang', 'rendah'] },
    },
    required: ['no', 'alasan', 'jawaban', 'yakin'],
    propertyOrdering: ['no', 'alasan', 'jawaban', 'yakin'],
  },
};

function buildQuizPrompt(questions, title = '') {
  const body = questions
    .map((q) => `${q.no}. ${q.soal}${q.gambar ? ' [soal ini berisi gambar yang tidak terlihat]' : ''}\n` +
      q.pilihan.map((p, i) => `${'abcdefghij'[i]}. ${p}`).join('\n'))
    .join('\n\n');
  return (title ? `Kuis: ${title}\n\n` : '') + 'Jawab semua soal berikut:\n\n' + body;
}

function parseAnswers(raw) {
  const json = String(raw || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('Format jawaban AI tidak dikenali');
  return arr.map((a) => {
    const jawaban = String(a.jawaban ?? '').trim();
    const huruf = jawaban.match(/^\(?([a-j])[.)]?$/i); // "B", "b.", "(b)" -> "b"
    return {
      no: Number(a.no),
      jawaban: huruf ? huruf[1].toLowerCase() : jawaban,
      alasan: String(a.alasan ?? ''),
      yakin: ['tinggi', 'sedang', 'rendah'].includes(a.yakin) ? a.yakin : 'sedang',
    };
  });
}

// ---------- Forum: bantu pahami pertanyaan dosen (bukan jawaban siap tempel) ----------
const FORUM_SYSTEM =
  'Kamu tutor mata kuliah yang membantu mahasiswa memahami pertanyaan forum diskusi dari dosen. ' +
  'Jika materi dosen (PowerPoint/PDF/dokumen) disertakan, baca materinya dan dasarkan semua penjelasan pada materi itu. ' +
  'Jangan menulis jawaban forum yang siap ditempel. Berikan: ringkasan materi berupa poin-poin isi utama ' +
  '(kosongkan jika tidak ada materi); penjelasan konsep inti 2 sampai 4 kalimat supaya mahasiswa paham; ' +
  'poin kunci berupa frasa singkat (bukan kalimat panjang atau paragraf) yang perlu dibahas, beri nomor ' +
  'sesuai bagian pertanyaan jika pertanyaannya bertingkat; dan satu contoh nyata yang relevan. ' +
  'Gunakan teori baku buku teks dan bahasa Indonesia yang jelas.';

const FORUM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ringkasan_materi: { type: 'ARRAY', items: { type: 'STRING' } },
    penjelasan: { type: 'STRING' },
    poin: { type: 'ARRAY', items: { type: 'STRING' } },
    contoh: { type: 'STRING' },
  },
  required: ['ringkasan_materi', 'penjelasan', 'poin', 'contoh'],
  propertyOrdering: ['ringkasan_materi', 'penjelasan', 'poin', 'contoh'],
};

function buildForumPrompt(question, title = '', materi = []) {
  return (title ? `Topik forum: ${title}\n\n` : '') +
    (materi.length ? `Materi dosen terlampir: ${materi.join(', ')}\n\n` : '') +
    `Pertanyaan dosen:\n${question}`;
}

function parseForumHelp(raw) {
  const o = JSON.parse(String(raw || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (!o || !Array.isArray(o.poin)) throw new Error('Format jawaban AI tidak dikenali');
  const list = (a) => (Array.isArray(a) ? a.map(String).filter(Boolean) : []);
  return { ringkasan: list(o.ringkasan_materi), penjelasan: String(o.penjelasan ?? ''), poin: list(o.poin), contoh: String(o.contoh ?? '') };
}

// ---------- Materi dosen: link Mentari / Google Drive / Google Slides & Docs ----------
// Link dosen diubah jadi URL unduhan langsung. Google Slides/Docs diekspor ke .pptx/.docx.
function materialUrl(link) {
  let u;
  try { u = new URL(link); } catch { return null; }
  const id = u.pathname.match(/\/d\/([\w-]{10,})/)?.[1] || u.searchParams.get('id');
  if (u.hostname === 'docs.google.com' && id) {
    if (u.pathname.startsWith('/presentation/')) return `https://docs.google.com/presentation/d/${id}/export/pptx`;
    if (u.pathname.startsWith('/document/')) return `https://docs.google.com/document/d/${id}/export?format=docx`;
  }
  if (u.hostname === 'drive.google.com' && id) return `https://drive.google.com/uc?export=download&id=${id}`;
  if (u.hostname === 'mentari.unpam.ac.id') return u.href;
  return null; // host lain tidak punya izin akses dari extension
}

// Inflate dengan batas ukuran hasil: file kecil yang mengembang jadi raksasa (zip bomb) dihentikan.
async function inflateCapped(data, max) {
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { reader.cancel(); throw new Error('isi file terlalu besar'); }
    chunks.push(value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

const decodeXml = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Teks dari .pptx/.docx (file zip berisi XML). Tanpa library: baca central directory zip,
// inflate entri slide/dokumen dengan DecompressionStream, ambil isi tag <a:t>/<w:t> per paragraf.
// shortcut: zip64 (file > 4 GB) tidak didukung, tidak relevan untuk materi kuliah.
async function officeText(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('file zip tidak valid');
  const parts = [];
  let p = dv.getUint32(eocd + 16, true);
  const total = dv.getUint16(eocd + 10, true);
  if (total > MAX_ZIP_ENTRIES) throw new Error('isi file terlalu banyak');
  for (let n = total; n > 0; n--) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    const slide = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (!slide && name !== 'word/document.xml') continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    let data = new Uint8Array(buf, start, size);
    if (method === 8) data = await inflateCapped(data, MAX_UNZIP);
    else if (method !== 0) continue;
    const text = new TextDecoder().decode(data).split(/<\/(?:a|w):p>/)
      .map((par) => [...par.matchAll(/<(?:a|w):t(?:\s[^>]*)?>([^<]*)<\/(?:a|w):t>/g)].map((m) => decodeXml(m[1])).join(''))
      .filter((t) => t.trim()).join('\n');
    parts.push([slide ? Number(slide[1]) : 0, slide ? `Slide ${slide[1]}:\n${text}` : text]);
  }
  return parts.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('\n\n');
}

// ---------- My Unpam: rekap presensi ----------
// Persen dihitung dari pertemuan yang sudah berjalan (tanggal_mulai <= sekarang), bukan seluruh semester.
const MIN_PRESENSI = 75; // batas aman kehadiran (persen)
function presensiRekap(pertemuan, now = Date.now()) {
  const list = Array.isArray(pertemuan) ? pertemuan : [];
  const berjalan = list.filter((p) => !p.tanggal_mulai || new Date(p.tanggal_mulai).getTime() <= now);
  const hadir = berjalan.filter((p) => String(p.presensi_status || '').toLowerCase() === 'hadir').length;
  return { hadir, berjalan: berjalan.length, total: list.length, persen: berjalan.length ? Math.round((hadir / berjalan.length) * 100) : null };
}

// ---------- My Unpam: kartu ujian ----------
// Semester dari tanggal (cadangan kalau API jadwal tidak bisa dibaca): Ganjil Agustus-Januari, Genap Februari-Juli.
function semesterFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 8) return `Ganjil ${y}/${y + 1}`;
  if (m === 1) return `Ganjil ${y - 1}/${y}`;
  return `Genap ${y - 1}/${y}`;
}

// Ujian berikutnya: UTS selama pertemuan yang berjalan belum lewat separuh semester, sesudahnya UAS.
// Tanpa data presensi, dipakai bulan: UTS Agustus-November & Februari-Mei, UAS Desember-Januari & Juni-Juli.
function examFor({ progress, date = new Date() } = {}) {
  if (typeof progress === 'number' && Number.isFinite(progress)) return progress <= 0.5 ? 'UTS' : 'UAS';
  return [8, 9, 10, 11, 2, 3, 4, 5].includes(date.getMonth() + 1) ? 'UTS' : 'UAS';
}

// Indeks pilihan dropdown yang cocok. Utamakan yang persis sama; semester pendek (SP) dan remedial (RM) tidak ditebak.
function pickOption(texts, wanted) {
  const w = normText(wanted);
  const t = texts.map(normText);
  const exact = t.indexOf(w);
  if (exact >= 0) return exact;
  return t.findIndex((o) => o && !/\b(sp|rm)\b/.test(o) && (w.includes(o) || o.includes(w)));
}

// ---------- Mencocokkan soal di layar dengan hasil AI ----------
const normText = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').replace(/^[\s.,;:]+|[\s.,;:]+$/g, '');

// Soal di layar dikenali dari teks pilihannya (urutan bisa diacak); kalau seri, dari teks soalnya.
function matchQuestion(optionTexts, pageText, questions) {
  const opts = optionTexts.map(normText);
  let best = [];
  let bestScore = 0;
  for (const q of questions) {
    const score = q.pilihan.filter((p) => opts.includes(normText(p))).length;
    if (score > bestScore) [best, bestScore] = [[q], score];
    else if (score === bestScore && score > 0) best.push(q);
  }
  if (best.length <= 1) return best[0] || null;
  const page = normText(pageText);
  return best.find((q) => page.includes(normText(q.soal).slice(0, 80))) || null;
}

// Indeks pilihan di layar yang sama dengan teks jawaban AI.
function optionIndex(optionTexts, choiceText) {
  const opts = optionTexts.map(normText);
  const c = normText(choiceText);
  const exact = opts.indexOf(c);
  return exact >= 0 ? exact : opts.findIndex((o) => o && c && (o.includes(c) || c.includes(o)));
}

if (typeof module !== 'undefined') module.exports = { normalizeApiKey, semesterFromDate, examFor, pickOption, presensiRekap, MIN_PRESENSI, isMentariUrl, isSafeId, inflateCapped, pendingTasks, classRosters, serverStatus, QUIZ_SCHEMA, buildQuizPrompt, parseAnswers, buildForumPrompt, parseForumHelp, materialUrl, officeText, matchQuestion, optionIndex };
