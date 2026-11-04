# Contoh Struktur Deliverable: Produk "Rekomendasi Domain Data"

> **Dokumen diskusi** (2026-10-29), bukan fitur jadi. Tujuannya menyepakati bagian mana yang dihasilkan EA Desk dan bagian mana yang ditulis arsitek, sebelum diimplementasikan. Isi bagian dinamis memakai **data asli ENG-2026-001** per 29-10-2026.

## Legenda

| Tanda | Jenis | Artinya | Berubah ketika… |
| :-: | :-- | :-- | :-- |
| 🟦 | **Dinamis Struktural** | Bagian **standar semua deliverable EA**. Struktur sama untuk setiap produk; isinya ditarik dari data generik EA Desk (Produk, Engagement, Artefak, ADR, Gerbang) | Standar deliverable global diubah, atau data sumbernya berubah |
| 🟩 | **Dinamis Produk** | Struktur atau isi yang **unik karena definisi produk**: metode, kerangka bab isi, konten baku, tools | Produk naik versi (mis. resep D1–D8 diperbaiki) |
| ✍️ | **Manual** | Hasil berpikir arsitek. Ditulis di Word/Docs | Arsitek menulis atau merevisi |
| 🟨 | **Campuran** | Kerangka dan sebagian isi dinamis, ditambah paragraf manual | Keduanya |

**Aturan integritas.** Bagian 🟦 dan 🟩 diberi stempel sumber. Mengeditnya di Word tidak berarti apa-apa, karena akan tertimpa saat bagian otomatis diperbarui. Koreksinya dilakukan di EA Desk.

---

## Peta klasifikasi (ringkas)

| # | Bagian dokumen | Jenis | Sumber data di EA Desk |
| :-: | :-- | :-: | :-- |
| — | Lembar Kendali Dokumen | 🟦 | Produk (nama, versi, kode SOP, layanan TOGAF, klasifikasi*) · Engagement (kode, Sponsor, mode, tahap) · Artefak (pemilik, konsumen, status, lokasi) |
| — | Riwayat Versi & Persetujuan | 🟦 | Gerbang yang dilewati (tahap, penyetuju, tanggal, bukti) + snapshot per gerbang* |
| — | Kata Pengantar | ✍️ | — |
| — | Daftar Isi | (Word) | Dibuat otomatis oleh editor dokumen |
| 0 | Ringkasan Eksekutif | 🟨 | Dinamis: keputusan yang diminta, jumlah & status ADR. Manual: narasi SCQA |
| 1 | Tujuan Dokumen | 🟦 | Produk: deliverable, keputusan yang didukung, pelanggan, kapan dipakai · Engagement: keputusan yang diminta Sponsor |
| 2 | Ruang Lingkup | 🟦 | Engagement: masalah bisnis, vertical slice B-D-A-T, level strategi, risiko, di luar lingkup* |
| 3 | Metode | 🟩 | Produk: langkah resep (urutan, ketinggian L0/L1, hasil, rujukan) + tools |
| 4 | Prinsip & Kriteria Domain (D1) | 🟨 | Dinamis Produk: tabel kriteria baku produk* · Dinamis Struktural: status ADR kriteria · Manual: penyesuaian konteks |
| 5–9 | Bab isi D2–D7 (judul bab) | 🟩 | Judul & urutan bab diturunkan dari langkah resep yang menghasilkan "Bab Dx" |
| 5–9 | Bab isi D2–D7 (isi) | ✍️ | Analisis arsitek (SIPOC, CRUD, peta domain, fit-gap, stabilitas) |
| 10 | Keputusan Arsitektur (D8) | 🟦 | ADR engagement: kode, judul, status, pemutus, tanggal |
| 11 | Isu Terbuka | 🟦 | ADR berstatus Proposed + backlog /foundation engagement |
| 12 | Pemeliharaan Dokumen | 🟦 | Artefak (pemilik, konsumen) · Playbook (mekanisme /harvest, aturan supersede ADR) |
| 13 | Referensi | 🟨 | Dinamis: rujukan metode & tools produk, artefak masukan (mis. Matriks Domain BIO) · Manual: rujukan tambahan |
| L | Lampiran | ✍️ | — |

\* *Belum ada di EA Desk; perlu field baru (lihat bagian akhir).*

**Komposisi untuk produk ini:** 🟦 7 bagian · 🟩 2 bagian · 🟨 3 bagian · ✍️ 3 bagian (Kata Pengantar, isi bab analisis, Lampiran).

---

# CONTOH DOKUMEN

## Lembar Kendali Dokumen 🟦
> *Sumber: EA Desk · Produk "Rekomendasi Domain Data" v0.1 · ENG-2026-001 · diambil 29-10-2026 11:30 WIB. Ubah di EA Desk, bukan di dokumen ini.*

| | |
| :-- | :-- |
| **Judul** | Rekomendasi Domain Data Proses S3 Information Technology & Data |
| **Kode dokumen** | DLV/O-S313-01/ENG-2026-001/v0.1 *(usulan pola; perlu diselaraskan dengan penomoran Document Control WIKA)* |
| **Produk EA** | Rekomendasi Domain Data · v0.1 · Draft |
| **Layanan EA (TOGAF)** | ⚠️ *belum diisi di katalog produk* |
| **Kode output SOP** | O-S313-01 (Pedoman Fondasi & Metamodel EA) |
| **Klasifikasi informasi** | ⚠️ *belum ada field; SOP Tabel 2.9 menetapkan O-S313-01 = Internal* |
| **Engagement** | ENG-2026-001 · Mode M2 · Advisor · tahap /sprout · status Aktif · target 30-10-2026 |
| **Sponsor (pengesah)** | Riha Rizanah |
| **Domain Owner** | System Information Department |
| **Pemilik pemeliharaan** | Enterprise Architect (Abdul Malik Aljun) |
| **Konsumen** | Sponsor (Riha Rizanah), Data Governance Council |
| **Status dokumen** | Draft |

## Riwayat Versi & Persetujuan 🟦
> *Sumber: riwayat gerbang ENG-2026-001.*

| Versi | Gerbang | Disetujui oleh | Tanggal | Bukti |
| :-- | :-- | :-- | :-- | :-- |
| 0.1 | /seed (scope disetujui) | Riha Rizanah | 29-10-2026 08:23 | "Disampaikan secara lisan" ⚠️ |
| — | /sprout | — | — | *belum dilewati* |

## Kata Pengantar ✍️
*[Ditulis arsitek atau atas nama pimpinan.]*

## Daftar Isi
*[Dibuat otomatis oleh Word/Docs dari judul bab.]*

## 0. Ringkasan Eksekutif 🟨
> 🟦 **Keputusan yang diminta:** Menentukan Domain dan Sub-Domain berdasarkan rekomendasi yang diberikan.
> 🟦 **Status keputusan:** 8 ADR diusulkan (ADR-001 s.d. ADR-008), 0 disahkan.

✍️ *[Situasi · Komplikasi · Rekomendasi · Keputusan yang dibutuhkan. Maksimal satu halaman. Diisi terakhir.]*

## 1. Tujuan Dokumen 🟦
> *Sumber: katalog Produk EA + engagement.*

Dokumen ini adalah deliverable produk EA **Rekomendasi Domain Data**, yang dipakai untuk merekomendasikan Domain dan Sub-Domain Data berbasis Proses Bisnis L1/L2, misalnya untuk kebutuhan Data Governance.

- **Keputusan yang didukung produk:** Menetapkan Domain & Sub-Domain Data beserta pemiliknya.
- **Keputusan yang diminta Sponsor pada engagement ini:** Menentukan Domain dan Sub-Domain berdasarkan rekomendasi yang diberikan.
- **Pelanggan:** Sponsor tata kelola data, Data Governance Office.
- **Bentuk deliverable:** Rekomendasi Domain & Sub-Domain Data (D1–D8) + Executive Summary.

## 2. Ruang Lingkup 🟦
> *Sumber: Kanvas Scope ENG-2026-001.*

**Masalah bisnis.** Dalam proses implementasi Data Governance diperlukan penentuan Domain Data sebagai acuan baku dalam mengidentifikasi inisiatif Data ke depannya. Maka dari itu, EA sebagai Advisor dibutuhkan dalam memberikan rekomendasi Domain Data.

| Layer | Dalam lingkup |
| :-- | :-- |
| Business | Lingkup Proses Bisnis S3 Information Technology & Data, Proses Bisnis L1–L3 |
| Data | Domain Data yang teridentifikasi dari Proses Bisnis S3 |
| Application | Tidak masuk dalam lingkup |
| Technology | Tidak masuk dalam lingkup |

Level strategi: Bisnis · Risiko arsitektur: Sedang · Di luar lingkup: ⚠️ *belum ada field khusus*

## 3. Metode 🟩
> *Sumber: resep kerja Produk "Rekomendasi Domain Data" v0.1. Metode ini sama untuk setiap engagement yang memakai produk versi ini.*

| # | Langkah | Ketinggian | Dikerjakan di | Hasil | Rujukan |
| :-: | :-- | :-: | :-- | :-- | :-- |
| 1 | D1 · Sepakati prinsip & kriteria domain lebih dulu | L0 | /cultivate | ADR "Kriteria Domain Data" | Modul 01 |
| 2 | D2 · Business Object Discovery | L1 | /cultivate | Bab D2 Business Object Catalog | Modul 02, Studi Kasus 02a |
| 3 | D3 · CRUD Matrix proses × business object | L1 | /cultivate | Bab D3 CRUD Matrix | Modul 03 |
| 4 | D4–D5 · Clustering, batas, dan penamaan domain | L0 | /cultivate | Bab D4 Domain Map + D5 Definition Sheet | Modul 04 |
| 5 | D6–D7 · Fit-gap vs usulan Manajemen & uji pemekaran | L0 | /cultivate | Bab D6 Fit-Gap + D7 Stabilitas | Modul 05–06 |
| 6 | D8 · Keputusan terbuka → ADR untuk Sponsor | L0 | /cultivate | ADR per keputusan terbuka | Modul 07 |
| 7 | Ringkasan eksekutif & sign-off | L0 | /harvest | Executive Summary | Modul 08 |
| 8 | Tetapkan Data Owner per domain | L0 | /harvest | RACI Data per domain | — |

**Tools & teknik:** SIPOC per L2 + 7 filter business object · CRUD Matrix proses × business object · 3 tes ketinggian (ganti aplikasi, reorganisasi, so-what).

*Langkah tata kelola (/seed: kunci keputusan, buat dokumen kerja; /harvest: masukkan Domain Map ke /foundation) tidak dicantumkan, karena itu langkah pengelolaan engagement, bukan metode penyusunan isi.*

## 4. Prinsip & Kriteria Domain (D1) 🟨
> 🟩 *Tabel kriteria baku diambil dari konten baku produk v0.1.*

| ID | Kriteria | Cara menguji |
| :-- | :-- | :-- |
| K1 | Domain = batas tanggung jawab (ada satu pemilik yang akuntabel) | Bisa sebut satu jabatan pemilik? |
| K2 | Nama merujuk ke benda yang dikelola, bukan unit organisasi | Tes reorganisasi |
| K3 | Tidak bergantung pada aplikasi | Tes ganti aplikasi |
| K4 | Relevan bagi pengambil keputusan | Tes "so what" |

> 🟦 *Status persetujuan kriteria:* ⚠️ belum ada ADR "Kriteria Domain Data" berstatus Accepted.

✍️ *[Penyesuaian kriteria untuk konteks engagement ini, misalnya DP-09 "entri di domain enterprise" dan DP-10 "satu benda, dua objek".]*

## 5. Business Object Catalog (D2) — judul 🟩 · isi ✍️
*[SIPOC per proses L3, 7 filter, normalisasi sinonim/homonim, tabel BIO.]*

## 6. CRUD Matrix (D3) — judul 🟩 · isi ✍️
*[Matriks proses × BIO; proses yang meng-Create adalah kandidat pemilik.]*

## 7. Domain Map & Definition Sheet (D4–D5) — judul 🟩 · isi ✍️
*[Peta domain dan satu Definition Sheet per domain.]*

## 8. Fit-Gap terhadap Usulan Manajemen (D6) — judul 🟩 · isi ✍️
*[Perbandingan dengan Matriks Data Domain & BIO memakai kriteria D1.]*

## 9. Uji Stabilitas (D7) — judul 🟩 · isi ✍️
*[Simulasi pemekaran probis L1.]*

## 10. Keputusan Arsitektur (D8) 🟦
> *Sumber: ADR ENG-2026-001. Status terkini selalu di EA Desk; tabel ini snapshot per 29-10-2026 11:30.*

| ADR | Keputusan | Status | Diputuskan oleh |
| :-- | :-- | :-- | :-- |
| ADR-001 | Matriks Domain Manajemen diperluas dengan kelompok I. Technology & Data | Proposed | — |
| ADR-002 | Data & Metadata dan Reference Data ditetapkan sebagai domain enterprise, bukan sub-domain TI | Proposed | — |
| ADR-003 | Pelindungan Data Pribadi ditempatkan di Data & Metadata; regulasi dan kepatuhannya di domain Regulatory dan Compliance | Proposed | — |
| ADR-004 | Identity & Access menjadi sub-domain TI: rekaman akses milik S3.4.3, aturan akses milik S3.5.1 | Proposed | — |
| ADR-005 | EDW & BI bukan domain data; aset analitis dicatat sebagai metadata | Proposed | — |
| ADR-006 | Klasifikasi informasi dipecah: skema milik Keamanan Informasi, label per aset data ditetapkan Data Owner | Proposed | — |
| ADR-007 | Risiko TI, BCP, KPI TI, dan Lessons Learned dicatat sebagai entri domain enterprise; DRP tetap di TI | Proposed | — |
| ADR-008 | Configuration Item dan Asset adalah dua objek yang saling merujuk | Proposed | — |

*Isi lengkap (Context · Alternatives · Decision · Consequences) dapat dilampirkan otomatis sebagai Lampiran ADR.*

## 11. Isu Terbuka 🟦
> *Sumber: ADR Proposed + backlog /foundation ENG-2026-001.*

- 8 ADR menunggu keputusan Sponsor (lihat bab 10).
- Backlog /foundation dari engagement ini: belum ada.

✍️ *[Isu dan asumsi yang belum menjadi ADR (D8-01 s.d. D8-08 pada analisis v2.0) saat ini masih ditulis manual. Kandidat fitur: entitas "Isu/Asumsi" di EA Desk.]*

## 12. Pemeliharaan Dokumen 🟦
> *Sumber: Register Artefak + Playbook.*

- **Pemilik pemeliharaan:** Enterprise Architect (Abdul Malik Aljun). **Konsumen:** Sponsor (Riha Rizanah), Data Governance Council.
- **Mekanisme perubahan:** Perubahan isi diajukan sebagai ADR baru yang men-*supersede* ADR lama. Setelah engagement lulus gerbang /harvest, Domain Map yang disahkan masuk ke /foundation dan menjadi baseline. Revisi berikutnya dilakukan lewat engagement baru dengan produk yang sama.
- **Lokasi dokumen resmi:** ⚠️ `/home/clouduser/Projects/…/S3_Rekomendasi_Domain_Data_v2.0.md`. Ini path server, bukan tautan yang bisa dibuka Sponsor. Perlu dipindah ke SharePoint/Docs.

## 13. Referensi 🟨
> 🟦 *Dinamis:*
- Rujukan metode produk: Self Learning and Capability / Data Domain Design (Applied), Modul 01–08 (D1–D8).
- Artefak masukan: Matriks Data Domain & BIO (Senior Manager System Information), status Disahkan.

✍️ *[Rujukan tambahan: TOGAF 10, DAMA-DMBOK, COBIT 2019, ITIL 4, UU 27/2022 PDP, dsb.]*

## Lampiran ✍️
*[SIPOC lengkap, glosarium homonim, catatan implementasi L2+.]*

---

# Panel validasi kelengkapan sumber (ditampilkan EA Desk sebelum dokumen dibuat)

| # | Temuan | Dampak di dokumen | Diperbaiki di |
| :-: | :-- | :-- | :-- |
| 1 | Layanan EA (TOGAF) produk kosong | Lembar Kendali tidak lengkap | Pembuatan Produk |
| 2 | Klasifikasi informasi belum ada | Dokumen tanpa label kerahasiaan | Field baru di Produk |
| 3 | Bukti persetujuan /seed: "disampaikan secara lisan" | Jejak audit lemah | Catatan gerbang (tautan notulen/email) |
| 4 | Lokasi artefak berupa path server | Sponsor tidak bisa membuka | Register Artefak |
| 5 | ADR "Kriteria Domain Data" belum ada | Bab 4 tanpa dasar keputusan | Buat ADR dari langkah D1 |
| 6 | Mode engagement (Advisor) ≠ mode default produk (Curator) | Informasi, bukan blokir | Kanvas Scope (saat /seed) |

*Usulan aturan: temuan 1–2 **memblokir** pembuatan dokumen; temuan 3–6 tampil sebagai peringatan.*

---

# Kebutuhan data baru (untuk implementasi)

| Entitas | Field baru | Dipakai di |
| :-- | :-- | :-- |
| Produk EA | **Klasifikasi informasi** (Publik/Internal/Rahasia) | Lembar Kendali |
| Produk EA | **Pola kode dokumen** | Lembar Kendali |
| Produk EA | **Konten baku** (blok Markdown bernama, mis. "Kriteria D1") | Bab 4 (🟩) |
| Produk EA | **Kerangka bab isi**: penanda langkah mana yang menjadi bab dokumen, serta pemisahan langkah *metode* dan langkah *tata kelola* | Bab 3, 5–9 (🟩) |
| Engagement | **Di luar lingkup** | Bab 2 |
| Artefak | **Versi dokumen** | Lembar Kendali, Riwayat Versi |
| Gerbang | **Snapshot** bagian otomatis saat lulus gerbang | Riwayat Versi |
| Global | **Standar Struktur Deliverable EA** (urutan bagian 🟦, satu definisi untuk semua produk) | Seluruh dokumen |
