# Rekomendasi Domain & Sub-Domain Data — [Lingkup, mis. S3 Information Technology & Data]

| Engagement | [ENG-xxxx-xxx] | Versi | 0.1 (Draft) |
| :--- | :--- | :--- | :--- |
| Sponsor | [nama/jabatan] | Penyusun | [Enterprise Architect] |
| Keputusan yang diminta | [mis. Menyetujui daftar domain & sub-domain data beserta pemiliknya] | Target | [tanggal] |

> Cara pakai: isi bab secara berurutan. Bab 1 disetujui Sponsor **sebelum** bab 2 dikerjakan. Analisis ditulis di level L0–L1 (strategis/konseptual). Detail tabel/kolom/aplikasi dicatat di Lampiran C, bukan di badan dokumen.

## 0. Ringkasan (diisi terakhir)
- **Situasi:** …
- **Komplikasi:** …
- **Rekomendasi:** … (daftar domain + pemilik dalam 3–5 baris)
- **Keputusan yang dibutuhkan dari Sponsor:** … (rujuk ADR)

## 1. Scope, Prinsip & Kriteria Domain (D1)
**Lingkup:** Probis L1 [..], L2 yang dianalisis: [..]. Di luar lingkup: [..].
**Penggunaan hasil:** [Data Governance / MDM / BI].

| # | Kriteria domain | Cara menguji |
| :-: | :--- | :--- |
| K1 | Domain = batas tanggung jawab (ada satu pemilik yang akuntabel) | Bisa sebut satu jabatan pemilik? |
| K2 | Nama merujuk ke benda yang dikelola, bukan unit organisasi | Tes reorganisasi: tetap benar bila divisi digabung? |
| K3 | Tidak bergantung pada aplikasi | Tes ganti aplikasi: tetap benar bila sistem diganti? |
| K4 | Relevan bagi pengambil keputusan | Tes "so what": direktur peduli? |
| K5 | [kriteria tambahan yang disepakati] | |

Status: ☐ Disetujui Sponsor pada [tanggal] (ADR-xxx)

## 2. Business Object Catalog (D2)
Metode: SIPOC per L2 → 7 filter → normalisasi sinonim/homonim.

| Business Object | Definisi (1 kalimat) | Sumber L2 | Kategori (Master/Reference/Transaction) | Catatan homonim |
| :--- | :--- | :--- | :--- | :--- |
| | | | | |

## 3. CRUD Matrix Proses L2 × Business Object (D3)
| Business Object | L2-a | L2-b | L2-c | … |
| :--- | :-: | :-: | :-: | :-: |
| | C | R | U | |

## 4. Data Domain Map (D4) & Definition Sheet (D5)
**Peta domain (L0):** [diagram atau daftar bertingkat Domain → Sub-domain]

Untuk setiap domain:
| Domain | [nama] |
| :--- | :--- |
| Definisi | |
| Isi (business object utama) | |
| Batas (yang bukan bagian domain ini) | |
| Kandidat pemilik (jabatan) | |
| Tingkat strategis | Core / Supporting / Generic |
| Lolos K1–K5? | |

## 5. Fit-Gap terhadap Usulan Manajemen (D6)
| Usulan Manajemen | Rekomendasi EA | Fit / Gap | Alasan (rujuk kriteria K1–K5) |
| :--- | :--- | :--- | :--- |
| | | | |

## 6. Uji Stabilitas: Simulasi Pemekaran Probis (D7)
| Skenario perubahan probis | Domain terdampak | Stabil? | Catatan |
| :--- | :--- | :-: | :--- |
| | | | |

## 7. Keputusan Terbuka, Asumsi & Isu (D8)
| # | Keputusan / isu | Opsi | Rekomendasi | ADR | Status |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | | | | ADR-xxx | Proposed |

## Lampiran
- A. SIPOC per L2
- B. Glosarium istilah baku (homonim yang disepakati)
- C. Catatan implementasi yang diparkir (L2–L4: tabel, aplikasi, integrasi), untuk fase Application/Data Architecture berikutnya
