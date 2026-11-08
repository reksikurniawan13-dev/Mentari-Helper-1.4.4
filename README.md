# Mentari Helper

Extension Chrome/Brave untuk [Mentari UNPAM](https://mentari.unpam.ac.id) dan [My Unpam](https://my.unpam.ac.id). Made by Rex.

## Fitur

**Mentari**
- Pengingat tugas yang belum selesai per mata kuliah: forum diskusi, pretest, post test, kuesioner.
- Peringatan saat server Mentari penuh, dan jawaban ditahan lalu dikirim otomatis saat server normal.
- Bantuan quiz dengan AI (Gemini).
- "Bantu pahami soal" di forum: AI membaca materi dosen (PPT, PDF, DOCX) lalu memberi penjelasan dan poin penting.
- Kuesioner terisi "Ya" dan terkirim otomatis, termasuk kuesioner popup.
- Daftar mahasiswa kelas (nama dan NIM).

**My Unpam**
- Semester berjalan dan rekap presensi.
- Kuesioner KHS dengan pilihan jawaban per dosen.
- Cetak kartu ujian UTS/UAS sekali klik.

Panel menyatu di halaman (kiri, bisa diubah ukurannya, tema terang dan gelap).

## Pasang

1. Unduh repo ini (Code > Download ZIP), lalu ekstrak.
2. Buka `chrome://extensions` (atau `brave://extensions`), nyalakan **Developer mode**.
3. Klik **Load unpacked**, pilih folder hasil ekstrak.
4. Buka pengaturan extension, tempel Gemini API key dari [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

API key hanya disimpan di browser dan hanya dikirim ke Google Gemini.

## Tes

```
node test.js
```
