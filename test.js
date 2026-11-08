// Self-check logika murni: node test.js
const assert = require('assert');
const { normalizeApiKey, semesterFromDate, examFor, pickOption, presensiRekap, isMentariUrl, isSafeId, inflateCapped, pendingTasks, classRosters, serverStatus, buildQuizPrompt, parseAnswers, buildForumPrompt, parseForumHelp, materialUrl, matchQuestion, optionIndex } = require('./lib.js');

const r = classRosters([
  { kode_course: '20261-06SISE001-1', peserta: [{ nim: 2, nama_mahasiswa: 'Budi' }, { nim: 1, nama_mahasiswa: 'Ani' }] },
  { kode_course: '20261-06SISE001-2', peserta: [{ nim: 1, nama_mahasiswa: 'Ani' }, { nim: 3, nama_mahasiswa: 'Citra' }] },
  { kode_course: '20261-07TPLE002-3', peserta: [{ nim: 9, nama_mahasiswa: 'Dewi' }] },
  { kode_course: 'TANPA', peserta: [] },
  { kode_course: '20261-06SISE001-4' }, // tanpa peserta: tidak dihitung
]);
assert.deepStrictEqual(Object.keys(r), ['06SISE001', '07TPLE002', 'TANPA']);
assert.strictEqual(r['06SISE001'].courses, 2);
assert.deepStrictEqual(r['06SISE001'].members.map((m) => m.nama + m.nim), ['Ani1', 'Budi2', 'Citra3']);

const course = {
  kode_course: 'ABC123',
  coursename: 'Etika Profesi',
  data: [
    { nama_section: 'Pertemuan 1', sub_section: [{ kode_template: 'FORUM_DISKUSI', id: 'f1', completion: true }] },
    { nama_section: 'Pertemuan 2', sub_section: [{ kode_template: 'FORUM_DISKUSI', id: 'f2', completion: false }] },
    { nama_section: 'Pertemuan 3', sub_section: [{ kode_template: 'FORUM_DISKUSI', id: 'f3', completion: false, warningAlert: 'Soal forum diskusi belum tersedia' }] },
    { nama_section: 'Pertemuan 4', sub_section: [{ kode_template: 'FORUM_DISKUSI', id: 'f4', completion: false, warningAlert: 'Selesaikan materi lainnya terlebih dahulu' }] },
    { nama_section: 'UTS', sub_section: [{ kode_template: 'POST_TEST', id: 'q1' }] },
    { nama_section: 'Kosong' },
  ],
};
const p = pendingTasks(course);
assert.deepStrictEqual(p.map((f) => f.id), ['FORUM_DISKUSI:f2', 'FORUM_DISKUSI:f4']); // UTS tanpa forum: tidak ikut
assert.strictEqual(p[0].url, 'https://mentari.unpam.ac.id/u-courses/ABC123/forum/f2');
assert.strictEqual(p[1].note, 'Selesaikan materi lainnya terlebih dahulu');
assert.deepStrictEqual(pendingTasks({}), []);

// Forum sudah diisi, tapi pretest/post test/kuesioner pertemuan itu masih tampil.
const p5 = pendingTasks({ kode_course: 'K', coursename: 'APSI', data: [
  { nama_section: 'Pertemuan 5', kode_section: 'S5', sub_section: [
    { kode_template: 'PRE_TEST', id: 'a', completion: false },
    { kode_template: 'BUKU_ISBN', id: 'b', completion: false },
    { kode_template: 'FORUM_DISKUSI', id: 'c', completion: true },
    { kode_template: 'POST_TEST', id: 'd', completion: false, warningAlert: 'Selesaikan forum diskusi terlebih dahulu' },
    { kode_template: 'KUESIONER', completion: false }] },
  { nama_section: 'Pertemuan 6', kode_section: 'S6', sub_section: [ // belum dibuka: tidak ada id
    { kode_template: 'PRE_TEST', completion: false }, { kode_template: 'KUESIONER', completion: false }] },
  { nama_section: 'Pertemuan 4', sub_section: [{ kode_template: 'KUESIONER', completion: false }, { kode_template: 'POST_TEST', id: 'e', completion: true }] },
  { nama_section: 'Pertemuan 7', kode_section: 'S7', sub_section: [ // pretest sudah dibuka, forum belum: tidak ikut
    { kode_template: 'PRE_TEST', id: 'g', completion: false }, { kode_template: 'FORUM_DISKUSI', completion: false }] },
  { nama_section: 'Pertemuan 8', kode_section: 'S8', sub_section: [ // soal forum belum tersedia: tidak ikut
    { kode_template: 'PRE_TEST', id: 'h', completion: false },
    { kode_template: 'FORUM_DISKUSI', id: 'i', completion: false, warningAlert: 'Soal forum diskusi belum tersedia' }] },
] });
assert.deepStrictEqual(p5.map((t) => `${t.label}|${t.url.split('/K/')[1]}`), ['Pretest|exam/a', 'Post test|exam/d', 'Kuesioner|kuesioner/S5']);
assert.strictEqual(p5[1].note, 'Selesaikan forum diskusi terlebih dahulu');

assert.strictEqual(serverStatus({ status: 0 }).level, 'busy');
assert.strictEqual(serverStatus({ status: 503, ms: 100 }).level, 'busy');
assert.strictEqual(serverStatus({ status: 429, ms: 100 }).level, 'busy');
assert.strictEqual(serverStatus({ status: 200, ms: 9000 }).level, 'slow');
assert.strictEqual(serverStatus({ status: 401, ms: 300 }).level, 'ok'); // tanpa token tetap berarti server hidup

const prompt = buildQuizPrompt([{ no: 1, soal: 'Ibukota Indonesia?', pilihan: ['Bandung', 'Jakarta'] }]);
assert.ok(prompt.includes('1. Ibukota Indonesia?\na. Bandung\nb. Jakarta'));

assert.deepStrictEqual(parseAnswers('```json\n[{"no":"1","jawaban":"b","alasan":"x"}]\n```'), [{ no: 1, jawaban: 'b', alasan: 'x', yakin: 'sedang' }]);
assert.deepStrictEqual(parseAnswers('[{"no":2,"jawaban":"B.","alasan":"","yakin":"tinggi"},{"no":3,"jawaban":"(c)","yakin":"rendah"}]').map((a) => a.jawaban + a.yakin), ['btinggi', 'crendah']);
assert.strictEqual(parseAnswers('[{"no":4,"jawaban":"Basis data relasional"}]')[0].jawaban, 'Basis data relasional'); // esai tidak diubah
assert.ok(buildQuizPrompt([{ no: 1, soal: 'X', pilihan: [], gambar: true }], 'Post Test').startsWith('Kuis: Post Test'));

// Pencocokan soal di layar: pilihan diacak, dan soal dengan pilihan sama dibedakan lewat teks soal.
const qs = [
  { no: 1, soal: 'Ibukota Indonesia?', pilihan: ['Bandung', 'Jakarta', 'Surabaya'] },
  { no: 2, soal: 'Bumi itu bulat.', pilihan: ['Benar', 'Salah'] },
  { no: 3, soal: 'Matahari terbit dari barat.', pilihan: ['Benar', 'Salah'] },
];
assert.strictEqual(matchQuestion(['  surabaya', 'JAKARTA', 'Bandung.'], '', qs).no, 1);
assert.strictEqual(matchQuestion(['Salah', 'Benar'], 'Soal 3 dari 3\nMatahari terbit dari barat.', qs).no, 3);
assert.strictEqual(matchQuestion(['Salah', 'Benar'], 'teks lain', qs), null); // ragu: jangan menebak
assert.strictEqual(matchQuestion(['X', 'Y'], '', qs), null);
assert.strictEqual(optionIndex(['Surabaya', 'Jakarta', 'Bandung'], 'Jakarta'), 1);
assert.strictEqual(optionIndex(['Model relasional basis data', 'Hierarki'], 'model relasional'), 0);
assert.strictEqual(optionIndex(['A', 'B'], 'Z'), -1);
assert.throws(() => parseAnswers('{"no":1}'));

assert.strictEqual(buildForumPrompt('Jelaskan 1NF!', 'Normalisasi'), 'Topik forum: Normalisasi\n\nPertanyaan dosen:\nJelaskan 1NF!');
assert.deepStrictEqual(parseForumHelp('{"penjelasan":"p","poin":["a","",2],"contoh":"c"}'), { ringkasan: [], penjelasan: 'p', poin: ['a', '2'], contoh: 'c' });
assert.ok(buildForumPrompt('Q', '', ['PPT 10']).startsWith('Materi dosen terlampir: PPT 10'));
assert.strictEqual(materialUrl('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn/edit'), 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn/export/pptx');
assert.strictEqual(materialUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view'), 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMn');
assert.strictEqual(materialUrl('https://youtu.be/xyz'), null);
assert.throws(() => parseForumHelp('{"penjelasan":"p"}'));

// Rekap presensi: hanya pertemuan yang sudah berjalan yang dihitung.
const now = new Date('2026-10-25T00:00:00+07:00').getTime();
const pert = [
  { tanggal_mulai: '2026-09-01', presensi_status: 'hadir' },
  { tanggal_mulai: '2026-09-08', presensi_status: 'HADIR' },
  { tanggal_mulai: '2026-09-15', presensi_status: null },
  { tanggal_mulai: '2026-09-22', presensi_status: 'alpa' },
  { tanggal_mulai: '2026-11-30', presensi_status: null }, // belum berjalan
];
assert.deepStrictEqual(presensiRekap(pert, now), { hadir: 2, berjalan: 4, total: 5, persen: 50 });
assert.deepStrictEqual(presensiRekap([], now), { hadir: 0, berjalan: 0, total: 0, persen: null });
assert.deepStrictEqual(presensiRekap(undefined, now).total, 0);

// Gemini API key: format baru AQ. (ada titik) dan format lama AIza, spasi/kutip dibuang.
const aq = 'AQ.Ab0FakeTestKey_0123456789-abcdefGHIJKLmnopQRSTuv';
assert.strictEqual(normalizeApiKey(aq), aq);
assert.strictEqual(normalizeApiKey(`  "${aq.slice(0, 20)}\n${aq.slice(20)}"  `), aq);
assert.strictEqual(normalizeApiKey('AIzaSyD-0123456789abcdefghijklmnopqrstu'), 'AIzaSyD-0123456789abcdefghijklmnopqrstu');
assert.strictEqual(normalizeApiKey('AQ.' + 'x'.repeat(300)).length, 303); // key panjang tidak terpotong
assert.strictEqual(normalizeApiKey('bukan key valid!'), null);
assert.strictEqual(normalizeApiKey('https://aistudio.google.com/apikey'), null);
assert.strictEqual(normalizeApiKey('pendek'), null);

// Kartu ujian: semester, jenis ujian, pilihan dropdown.
assert.strictEqual(semesterFromDate(new Date('2026-10-25')), 'Ganjil 2026/2027');
assert.strictEqual(semesterFromDate(new Date('2027-01-10')), 'Ganjil 2026/2027');
assert.strictEqual(semesterFromDate(new Date('2027-03-01')), 'Genap 2026/2027');
assert.strictEqual(examFor({ progress: 0.4 }), 'UTS');
assert.strictEqual(examFor({ progress: 0.6 }), 'UAS');
assert.strictEqual(examFor({ date: new Date('2026-10-25') }), 'UTS');
assert.strictEqual(examFor({ date: new Date('2026-12-20') }), 'UAS');
assert.strictEqual(examFor({ progress: NaN, date: new Date('2027-06-15') }), 'UAS');
const sems = ['GENAP 2026/2027 SP', 'GENAP 2026/2027', 'GANJIL 2026/2027', 'GANJIL 2022/2023 - RM'];
assert.strictEqual(pickOption(sems, 'Ganjil 2026/2027'), 2);
assert.strictEqual(pickOption(sems, 'GENAP 2026/2027'), 1); // bukan yang SP
assert.strictEqual(pickOption(sems, 'Semester Ganjil 2026/2027'), 2);
assert.strictEqual(pickOption(sems, 'Ganjil 2030/2031'), -1);
assert.strictEqual(pickOption(['UTS', 'UAS'], 'uas'), 1);

// Keamanan: token hanya ke origin Mentari persis, ID hanya karakter aman.
assert.ok(isMentariUrl('https://mentari.unpam.ac.id/api/file/a.pdf'));
assert.ok(!isMentariUrl('https://mentari.unpam.ac.id.evil.com/api/file/a.pdf'));
assert.ok(!isMentariUrl('http://mentari.unpam.ac.id/x'));
assert.ok(!isMentariUrl('javascript:alert(1)'));
assert.ok(isSafeId('20261-06SISE001-55201') && isSafeId('a_b.c'));
assert.ok(!isSafeId('../x') && !isSafeId('a/b') && !isSafeId('') && !isSafeId(5));

(async () => {
  // Zip bomb: 10 MB nol terkompresi jadi ~10 KB, inflate dihentikan di batas.
  const zeros = new Uint8Array(10e6);
  const packed = new Uint8Array(await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  await assert.rejects(inflateCapped(packed, 5e6), /terlalu besar/);
  assert.strictEqual((await inflateCapped(packed, 11e6)).length, 10e6);
  console.log('ok');
})();
