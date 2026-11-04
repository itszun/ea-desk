# EA Desk — Visi & Batas Solusi

> Status: v0 (POC) · Pemilik: Abdul Malik Aljun · Tanggal: 2026-10-28

## 1. Masalah yang diselesaikan

Fungsi EA di WIKA baru tumbuh. Pekerjaannya tersebar di chat, rapat, dan dokumen, sehingga:

1. **Arus kerja EA tidak terlihat.** Tidak jelas inisiatif mana yang sedang didampingi, di gerbang mana, dan siapa yang menunggu siapa.
2. **Intensitas keterlibatan tidak dikendalikan.** Semua permintaan diperlakukan sama, padahal kapasitas EA terbatas.
3. **Keputusan dan aset hilang setelah proyek selesai** (*orphan architecture*, R-S313-02 / R-S313-04).
4. **Dampak EA sulit dibuktikan.** Arsitek sendiri sulit melihat nilai kerjanya.

## 2. Posisi aplikasi

EA Desk adalah **sistem manajemen kerja fungsi EA**. Ia menjalankan cara kerja EA, bukan memodelkan arsitektur.

| EA Desk **adalah** | EA Desk **bukan** |
| :--- | :--- |
| Sistem kerja untuk *Collaboration & Task Management / Workflow* (kolom "Dukungan SI" Tabel 2.7 SOP 2.3.3) | EA Repository / tool pemodelan (Sparx EA, LeanIX, Archi) |
| Pencatat engagement, gerbang, keputusan (ADR), dan register artefak | Tempat menggambar diagram BDAT atau menyimpan objek metamodel |
| Penegak aturan kerja (*decision first*, *no orphan*, *stage-gate*) | Project management umum (Jira/Trello) |

Artefak tetap dibuat di tool masing-masing. EA Desk mencatat **siapa pemiliknya, siapa konsumennya, untuk keputusan apa, dan di mana letaknya**.

## 3. Rujukan operating model

Aplikasi ini menerjemahkan rujukan berikut ke dalam alur kerja:

| Rujukan | Diterjemahkan menjadi |
| :--- | :--- |
| TOGAF 10 — EA Capability sebagai entitas operasional (Modul 08: *treat EA like a business*) | Dashboard kapasitas, kinerja, dan jejak dampak |
| TOGAF 10 — EA Services (Modul 05) | Setiap pekerjaan masuk sebagai **Engagement** (permintaan layanan EA) |
| TOGAF 10 — Governance, Phase G, Phase H, Requirements Mgmt (Modul 10, 20–22) | Stage-gate dengan kriteria keluar, ADR, alignment review, umpan balik ke fondasi |
| Siklus *Planting Seed* (`/foundation → /seed → /sprout → /cultivate → /harvest`) | Tahapan engagement + backlog fondasi |
| 4 Mode Keterlibatan EA (Co-Pilot, Advisor, Gatekeeper, Curator) | Triase mode di `/seed`; checklist dan beban kapasitas berbeda per mode |
| 6 Prinsip *Fit-for-Purpose* | Aturan yang ditegakkan oleh form dan gerbang (lihat §5) |
| RACI EA / Sponsor / Domain Owner / Delivery Team | Penyetuju tiap gerbang dan pengesah ADR |

## 3a. Produk EA dan resep kerja (v0.3)

Fungsi EA menjual **produk**: layanan terstandar (TOGAF EA Services, Modul 05) yang menghasilkan deliverable untuk satu jenis keputusan. Contohnya *Rekomendasi Domain Data* (O-S313-01), *Architecture Alignment Review* (O-S313-04), dan *Asesmen Kelayakan Teknologi* (O-S313-06).

| Konsep | Arti | Di aplikasi |
| :--- | :--- | :--- |
| **Produk EA** | *Apa* yang diserahkan: deliverable, pelanggan, keputusan yang didukung | Katalog Produk EA |
| **Resep kerja** | *Cara* membuatnya: langkah per tahap (dengan level ketinggian L0/L1), tools, dan template | Ditampilkan di tiap tahap engagement, dengan penanda "Mulai di sini" |
| **Engagement** | Satu pesanan produk untuk satu Sponsor | Siklus Planting Seed |
| **Kriteria gerbang** | Bukti selesai yang ditinjau penyetuju | Checklist gerbang (terpisah dari resep) |

Siklusnya: engagement memakai resep → lessons learned di `/harvest` ditandai ke produknya → resep diperbaiki (naik versi dan kematangan Draft → Teruji → Baku). Dengan begitu, prinsip *Project Cultivates, EA Harvests* juga berlaku untuk metode kerja EA sendiri.

Planting Seed dan metode produk adalah **dua sumbu yang berbeda**. Planting Seed mengatur tata kelola (kapan EA terlibat, siapa menyetujui, kapan aset dipanen) dan sama untuk semua produk. Metode produk mengatur cara memproduksi deliverable dan berbeda untuk tiap produk. Setiap langkah metode dipetakan ke tahap Planting Seed tempat ia dikerjakan. Produk dirancang di menu **Pembuatan Produk** dan disimpan di database. `playbook.json` hanya berisi produk awal (*seed*) dan aturan tata kelola.

Dokumen deliverable tetap dibuat di penyimpanan resmi (Word/SharePoint atau Google Docs). EA Desk hanya menyediakan template dan mencatat link, pemilik, dan statusnya.

## 4. Pengguna

- **Utama:** Enterprise Architect (saat ini satu orang). Semua input dilakukan oleh EA.
- **Penerima manfaat:** Sponsor, Domain Owner, dan Delivery Team. Mereka dicatat sebagai pihak (nama/peran), belum sebagai pengguna login.

## 5. Aturan kerja yang ditegakkan aplikasi

| Prinsip | Bentuk penegakan |
| :--- | :--- |
| Know Your Customer & **Decision First** | Engagement tidak bisa dibuat tanpa *keputusan yang harus diambil* dan Sponsor |
| **Vertical Slice** | Kanvas scope wajib memetakan irisan B-D-A-T |
| **Riding Sponsor Strategy** | Sponsor wajib; level strategi (Korporat/Bisnis/Fungsional) dicatat |
| **Fit-for-Purpose** | Mode menentukan tahapan dan checklist gerbang |
| **No Orphan Architecture** | Artefak tidak bisa didaftarkan tanpa Owner, Consumer, dan Tujuan |
| **Project Cultivates, EA Harvests** | Engagement tidak bisa ditutup sebelum gerbang `/harvest`; lessons learned masuk backlog `/foundation` |

## 6. Prinsip desain solusi

1. **Proses sebagai konfigurasi.** Tahapan, checklist, mode, dan prinsip ada di `playbook.json`, bukan di kode. Saat cara kerja EA berubah, cukup ubah playbook.
2. **Satu layar, satu pertanyaan.** Dashboard menjawab "apa yang perlu saya lakukan hari ini". Detail engagement menjawab "posisi inisiatif ini dan apa yang menghalanginya".
3. **Ringan dan mudah dirawat.** Node.js 24 tanpa dependensi npm (`node:http` + `node:sqlite`), frontend Preact+htm tanpa build step. Satu file database yang mudah di-backup.

## 7. Ukuran keberhasilan POC

POC dinilai berhasil jika, setelah dua minggu dipakai sendiri:

- Semua permintaan EA yang aktif tercatat sebagai engagement dengan mode dan gerbangnya.
- Pertanyaan "apa yang menunggu keputusan Sponsor?" terjawab dalam satu layar.
- Ada jejak dampak yang bisa ditunjukkan ke atasan: keputusan yang disahkan, engagement yang di-*harvest*, dan perbaikan fondasi.

## 8. Di luar cakupan (sengaja)

Multi-user dan login per peran, notifikasi/email, pemodelan dan diagram, unggah file, integrasi (Jira/Teams/Odoo), dan laporan PDF. Masing-masing baru masuk sprint jika POC membuktikan kebutuhannya (lihat `BACKLOG.md`).
