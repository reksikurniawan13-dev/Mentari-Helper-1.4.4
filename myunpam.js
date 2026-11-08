// Fitur di my.unpam.ac.id: semester berjalan, rekap presensi, kartu ujian UTS/UAS, dan isi kuesioner KHS per dosen.
// Memakai UI kit dari content.js dan fungsi dari lib.js (keduanya dimuat lebih dulu di halaman yang sama).

ICON.print = 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z';
ICON.event = 'M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z';

// Token JWT My Unpam dicari di storage halaman. Hanya dipakai untuk request same-origin (path relatif)
// ke my.unpam.ac.id dan tidak pernah disimpan oleh extension.
function myToken() {
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const m = String(store.getItem(store.key(i))).match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
      if (m) return m[0];
    }
  }
  return null;
}

async function myApi(path) {
  const xsrf = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.slice(11);
  const token = myToken();
  const r = await fetch(path, {
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(xsrf ? { 'x-xsrf-token': decodeURIComponent(xsrf) } : {}),
    },
    credentials: 'same-origin',
  });
  if (r.status === 401 || r.status === 419) throw new Error('Sesi My Unpam habis. Login ulang lalu buka panel lagi.');
  if (!r.ok) throw new Error(`Gagal mengambil data (HTTP ${r.status}).`);
  const data = await r.json();
  return Array.isArray(data) ? data : data?.data; // API kadang membungkus hasil dalam { data: [...] }
}

// ---------- Semester berjalan + rekap presensi ----------
let akademik = null; // cache selama halaman terbuka; tombol Muat ulang mengambil lagi

async function loadAkademik() {
  const jadwal = await myApi('/api/presensi/mahasiswa/jadwal-kuliah');
  if (!Array.isArray(jadwal) || !jadwal.length) throw new Error('Jadwal kuliah semester ini belum tersedia.');
  const matkul = await Promise.all(jadwal.map(async (j) => {
    let pertemuan = null;
    try {
      pertemuan = await myApi(`/api/presensi/mahasiswa/jadwal-pertemuan/${encodeURIComponent(j.id_kelas)}/${encodeURIComponent(j.id_mata_kuliah)}`);
    } catch { /* mata kuliah tetap ditampilkan, presensinya "-" */ }
    return { nama: String(j.nama_mata_kuliah || '-'), sks: Number(j.sks) || 0, rekap: pertemuan ? presensiRekap(pertemuan) : null };
  }));
  const first = jadwal[0];
  // Progres semester = pertemuan berjalan / total, ambil yang paling jauh. Dipakai menebak UTS atau UAS.
  const ratios = matkul.map((m) => (m.rekap?.total ? m.rekap.berjalan / m.rekap.total : NaN)).filter(Number.isFinite);
  return {
    semester: String(first.nama_semester_registrasi || semesterFromDate()),
    nama: String(first.nama_mahasiswa || ''), nim: String(first.nim || ''), matkul,
    progress: ratios.length ? Math.max(...ratios) : undefined,
  };
}

async function renderAkademik(info, reload = false) {
  info.replaceChildren(el('div', { className: 'section' },
    el('div', { className: 'progress' }), el('div', { className: 'status', textContent: 'Mengambil jadwal dan presensi...' })));
  try {
    if (!akademik || reload) akademik = await loadAkademik();
  } catch (e) {
    akademik = null;
    return info.replaceChildren(kartuSection(), el('div', { className: 'section' },
      el('div', { className: 'status err', textContent: e.message }), button('Coba lagi', () => renderAkademik(info, true), 'outlined')));
  }
  const { semester, nama, nim, matkul } = akademik;
  const sks = matkul.reduce((n, m) => n + m.sks, 0);
  const kurang = matkul.filter((m) => m.rekap?.persen != null && m.rekap.persen < MIN_PRESENSI);
  info.replaceChildren(
    el('div', { className: 'section' },
      el('div', { className: 'label', textContent: 'Semester berjalan' }),
      el('div', { className: 'big', textContent: semester }),
      el('div', { className: 'muted', textContent: `${nama} · ${nim} · ${matkul.length} mata kuliah, ${sks} SKS` })),
    kartuSection(),
    el('div', { className: 'section' },
      el('h3', {}, svg(ICON.event), 'Rekap presensi',
        el('span', { className: `pill${kurang.length ? '' : ' zero'}`, textContent: kurang.length ? `${kurang.length} di bawah ${MIN_PRESENSI}%` : 'Aman' })),
      el('table', { className: 'roster rekap' },
        el('thead', {}, el('tr', {}, el('th', { textContent: 'Mata kuliah' }), el('th', { textContent: 'Hadir' }), el('th', { textContent: '%' }))),
        el('tbody', {}, ...matkul.map((m) => el('tr', { className: kurang.includes(m) ? 'low' : '' },
          el('td', { textContent: m.nama }),
          el('td', { textContent: m.rekap ? `${m.rekap.hadir}/${m.rekap.berjalan}` : '-' }),
          el('td', { textContent: m.rekap?.persen != null ? `${m.rekap.persen}%` : '-' }))))),
      el('div', { className: 'muted', textContent: `Dihitung dari pertemuan yang sudah berjalan. Batas aman ${MIN_PRESENSI}%.` }),
      button('Muat ulang', () => renderAkademik(info, true), 'outlined')));
}

// ---------- Kuesioner KHS: satu pilihan per dosen, lanjut halaman, lalu SIMPAN ----------
// Radio Quasar di My Unpam: <div class="q-radio" role="radio" aria-checked> berisi label, tanpa role="radiogroup".
// Radio dikenali dari role, kelas q-radio, atau input radio biasa; yang diambil hanya elemen terluar.
function surveyRadios() {
  const all = [...document.querySelectorAll('[role="radio"], .q-radio, input[type="radio"]')];
  return all.filter((r) => !all.some((o) => o !== r && o.contains(r)))
    .filter((r) => r.offsetParent !== null || r.closest('label')?.offsetParent);
}

// Satu pertanyaan = wadah terdekat yang memuat lebih dari satu radio.
function surveyGroups() {
  const radios = surveyRadios();
  const groups = new Map();
  for (const r of radios) {
    let box = r.parentElement;
    while (box && radios.filter((x) => box.contains(x)).length < 2) box = box.parentElement;
    if (!box) continue;
    if (!groups.has(box)) groups.set(box, Object.assign([], { box }));
    groups.get(box).push(r);
  }
  return [...groups.values()];
}

const radioText = (r) => (r.getAttribute('aria-label')
  || (r.matches('input') ? r.closest('label')?.innerText || r.value : r.innerText) || '').trim();
const isChecked = (r) => r.getAttribute('aria-checked') === 'true' || r.checked === true
  || Boolean(r.querySelector('.q-radio__inner--truthy, input[type="radio"]:checked'));
// Penanda isi halaman kuesioner: teks setiap pertanyaan (berubah saat pindah ke langkah berikutnya).
const surveyKey = () => surveyGroups().map((g) => g.box.parentElement?.innerText || '').join('|');
let filling = false;
keepPanelOpen = () => filling; // jangan tutup panel di tengah pengisian, status prosesnya ada di panel

// Hasil pengisian disimpan di node yang sama, supaya tetap terlihat setelah popup kuesioner tertutup.
const surveyOut = el('div');

function surveyTool() {
  const groups = surveyGroups();
  if (!groups.length) return null;
  const out = surveyOut;
  const choices = el('div', { className: 'choices' });
  groups[0].map(radioText).forEach((label, i) => choices.append(button(label || `Pilihan ${i + 1}`, () => fillSurvey(label, i, out, choices), 'outlined')));
  return el('div', {},
    el('h3', {}, svg(ICON.form), 'Kuesioner KHS'),
    el('div', { className: 'muted', textContent: 'Pilih jawaban untuk dosen ini. Semua pertanyaan diisi dengan pilihan itu, lanjut ke halaman berikutnya, lalu disimpan otomatis.' }),
    choices, out);
}

async function waitSurveyChange(oldKey) {
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    if (surveyGroups().length && surveyKey() !== oldKey) return true;
  }
  return false;
}

async function fillSurvey(label, index, out, choices) {
  filling = true;
  choices.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    for (let page = 1; page <= 30; page++) {
      const groups = surveyGroups();
      if (!groups.length) throw new Error('Pertanyaan kuesioner tidak ditemukan.');
      for (const g of groups) {
        const target = g.find((r) => normText(radioText(r)) === normText(label)) || g[Math.min(index, g.length - 1)];
        if (!isChecked(target)) clickSafe(target);
      }
      await sleep(400);
      const kosong = surveyGroups().filter((g) => !g.some(isChecked)).length;
      if (kosong) throw new Error(`${kosong} pertanyaan belum terpilih. Isi manual lalu klik SIMPAN.`);
      setStatus(out, `Halaman ${page} terisi "${label}"...`);

      const next = visibleButton(/\bselanjutnya\b/i);
      if (next) {
        const key = surveyKey();
        clickSafe(next);
        if (!(await waitSurveyChange(key))) throw new Error('Halaman berikutnya tidak terbuka. Lanjutkan manual.');
        continue;
      }
      const save = visibleButton(/\b(simpan|kirim|selesai|submit)\b/i);
      if (!save) throw new Error('Tombol SIMPAN tidak ditemukan. Simpan manual.');
      const saved = waitWrite(30000);
      clickSafe(save);
      const rep = await saved;
      if (!rep) return setStatus(out, 'SIMPAN sudah diklik, tapi balasan server tidak terdeteksi. Cek apakah kuesioner sudah tercatat.', 'err');
      if (!savedOk(rep)) throw new Error(`Gagal tersimpan (HTTP ${rep.status || 'tanpa respons'}). Pilih jawaban lagi untuk mencoba ulang.`);
      return setStatus(out, `Kuesioner tersimpan dengan jawaban "${label}".`, 'ok');
    }
    throw new Error('Kuesioner terlalu panjang. Lanjutkan manual.');
  } catch (e) {
    setStatus(out, e.message, 'err');
  } finally {
    filling = false;
    choices.querySelectorAll('button').forEach((b) => { b.disabled = false; });
  }
}

// ---------- Kartu ujian UTS/UAS ----------
// Halaman Cetak Kartu Ujian: dua q-select Quasar (Semester, Jenis Ujian), tabel jadwal, tombol CETAK.
const KARTU_PATH = '/data-akademik/kartu-ujian';
const kartuOut = el('div'); // status + jadwal ujian; node yang sama dipakai ulang setiap panel dibuka
let kartuBusy = false;
let kartuAutoDone = false;
keepPanelOpen = () => filling || kartuBusy; // jangan tutup panel di tengah proses

function kartuSection() {
  const sem = akademik?.semester || semesterFromDate();
  const rec = examFor({ progress: akademik?.progress });
  const btn = (j) => button(`Kartu ${j}${j === rec ? ' (sekarang)' : ''}`, () => startKartu(j), j === rec ? '' : 'outlined');
  return el('div', { className: 'section' },
    el('h3', {}, svg(ICON.print), 'Cetak kartu ujian'),
    el('div', { className: 'muted', textContent: `Semester ${sem}. Semester dan jenis ujian diisi otomatis, jadwal dicek, lalu kartu dicetak.` }),
    el('div', { className: 'choices kartu' }, btn('UTS'), btn('UAS')),
    kartuOut);
}

function startKartu(jenis) {
  if (location.pathname !== KARTU_PATH) {
    sessionStorage.setItem('mh-kartu', jenis); // dilanjutkan setelah halaman kartu ujian terbuka
    return location.assign(KARTU_PATH);
  }
  prepareKartu(jenis, true);
}

const fieldByLabel = (re) => [...document.querySelectorAll('.q-field')]
  .find((f) => re.test(f.querySelector('.q-field__label')?.innerText || ''));
const fieldValue = (f) => (f.querySelector('.q-field__native')?.innerText || f.querySelector('input')?.value || '').trim();

// Pilih opsi q-select: buka menu dengan klik kontrolnya, lalu klik item yang cocok.
async function chooseOption(labelRe, wanted, name) {
  const field = fieldByLabel(labelRe);
  if (!field) throw new Error('Form kartu ujian tidak ditemukan di halaman ini.');
  if (pickOption([fieldValue(field)], wanted) === 0) return fieldValue(field);
  (field.querySelector('.q-field__control') || field).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    const opts = [...document.querySelectorAll('.q-menu [role="option"], .q-menu .q-item')].filter((o) => o.offsetParent !== null);
    if (!opts.length) continue;
    const idx = pickOption(opts.map((o) => o.innerText), wanted);
    if (idx < 0) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      throw new Error(`${name} "${wanted}" tidak ada di daftar. Pilih manual.`);
    }
    const text = opts[idx].innerText.trim();
    clickSafe(opts[idx]);
    await sleep(300);
    return text;
  }
  throw new Error(`Daftar ${name} tidak terbuka. Pilih manual.`);
}

// Baris jadwal ujian di tabel halaman (baris "Tidak Ada Data" diabaikan). Tunggu sampai stabil.
const examRows = () => [...document.querySelectorAll('table tbody tr')]
  .filter((tr) => tr.cells.length >= 3 && !/tidak ada data/i.test(tr.innerText))
  .map((tr) => [...tr.cells].map((c) => c.innerText.trim()));

async function waitExamRows(ms = 10000) {
  let last = -1;
  for (let t = 0; t < ms; t += 250) {
    await sleep(250);
    const n = examRows().length;
    if (n && n === last) return examRows();
    last = n;
  }
  return examRows();
}

async function printKartu(cetak, jenis, sem) {
  clickSafe(cetak);
  await sleep(1500);
  const note = [...document.querySelectorAll('.q-notification')].pop();
  if (note) return setStatus(kartuOut, `Mentari: ${note.innerText.trim()}`, note.matches('.bg-negative, .bg-warning') ? 'err' : 'ok');
  setStatus(kartuOut, `Kartu ${jenis} ${sem} dicetak. Kalau tidak muncul, izinkan pop-up untuk my.unpam.ac.id.`, 'ok');
}

async function prepareKartu(jenis, print) {
  if (kartuBusy) return;
  kartuBusy = true;
  setStatus(kartuOut, `Menyiapkan kartu ${jenis}...`);
  try {
    const sem = await chooseOption(/semester/i, akademik?.semester || semesterFromDate(), 'Semester');
    await chooseOption(/jenis\s*ujian/i, jenis, 'Jenis ujian');
    setStatus(kartuOut, `Mengecek jadwal ${jenis} ${sem}...`);
    const rows = await waitExamRows();
    if (!rows.length) {
      return setStatus(kartuOut, `Jadwal ${jenis} ${sem} belum tersedia, jadi kartu belum bisa dicetak. Biasanya karena jadwal belum keluar atau pembayaran sampai ${jenis} belum terpenuhi.`, 'err');
    }
    const heads = [...document.querySelectorAll('table thead th')].map((th) => th.innerText.trim());
    const jadwal = el('table', { className: 'roster ujian' },
      el('thead', {}, el('tr', {}, ...heads.map((h) => el('th', { textContent: h })))),
      el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map((c) => el('td', { textContent: c }))))));
    const cetak = visibleButton(/\bcetak\b/i);
    if (!cetak) return kartuOut.replaceChildren(jadwal, el('div', { className: 'status err', textContent: 'Tombol CETAK tidak ditemukan. Cetak manual.' }));
    // Pop-up cetak butuh klik pengguna yang masih baru. Setelah pindah halaman, minta satu klik lagi.
    if (print && navigator.userActivation?.isActive) {
      kartuOut.replaceChildren(jadwal, el('div'));
      return await printKartu(cetak, jenis, sem);
    }
    kartuOut.replaceChildren(jadwal,
      el('div', { className: 'status ok', textContent: `${rows.length} jadwal ${jenis} ditemukan. Semester dan jenis ujian sudah terisi.` }),
      button(`Cetak kartu ${jenis} sekarang`, () => printKartu(cetak, jenis, sem)));
  } catch (e) {
    setStatus(kartuOut, e.message, 'err');
  } finally {
    kartuBusy = false;
  }
}

// Saat halaman kartu ujian terbuka: isi otomatis. Kalau datang dari tombol panel, langsung siap cetak.
async function autoKartu() {
  const flag = sessionStorage.getItem('mh-kartu');
  sessionStorage.removeItem('mh-kartu');
  if (!akademik) akademik = await loadAkademik().catch(() => null);
  const jenis = flag === 'UTS' || flag === 'UAS' ? flag : examFor({ progress: akademik?.progress });
  if (!document.getElementById('mh-panel')) openMyPanel();
  await prepareKartu(jenis, Boolean(flag));
}

// ---------- Panel My Unpam ----------
function openMyPanel() {
  const info = el('div');
  const survey = surveyTool() // kuesioner terbuka, atau hasil kuesioner terakhir
    || (surveyOut.childNodes.length ? el('div', {}, el('h3', {}, svg(ICON.form), 'Kuesioner KHS'), surveyOut) : null);
  mount('mh-panel', el('div', { className: 'card' },
    el('div', { className: 'head' },
      el('div', { className: 'badge' }, svg(survey ? ICON.form : ICON.event)),
      el('div', {}, el('div', { className: 'title', textContent: 'Mentari Helper' }),
        el('div', { className: 'sub', textContent: 'My Unpam: semester, presensi, kartu ujian, kuesioner KHS' })),
      el('div', { className: 'actions' }, themeToggle(), closeButton('mh-panel'))),
    el('div', { className: 'body' }, ...(survey ? [el('div', { className: 'section' }, survey)] : []), info),
    el('div', { className: 'foot' }, 'Mentari Helper · made by ', el('b', { textContent: 'Rex' }))));
  renderAkademik(info);
}

// Panel terbuka sendiri saat kuesioner muncul, dan diperbarui saat kuesioner ditutup.
let surveyShown = false;
function myTick() {
  const onKartu = location.pathname === KARTU_PATH;
  if (!onKartu) kartuAutoDone = false;
  else if (!kartuAutoDone && fieldByLabel(/jenis\s*ujian/i)) {
    kartuAutoDone = true;
    autoKartu();
  }
  if (filling) return;
  const present = surveyGroups().length > 0;
  if (present === surveyShown) return;
  surveyShown = present;
  if (present || document.getElementById('mh-panel')) openMyPanel();
}

if (location.hostname === 'my.unpam.ac.id') {
  mount('mh-fab', el('button', { className: 'fab', title: 'Mentari Helper by Rex',
    onclick: () => (document.getElementById('mh-panel') ? unmount('mh-panel') : openMyPanel()) }, svg(ICON.event, 26)));
  setInterval(myTick, 1000);
  myTick();
}
