# Backlog & Rencana Iterasi

Pola: **Overall POC** (seluruh alur ujung-ke-ujung, tipis) → **Sprint Agile** 1–2 minggu. Setiap sprint dimulai dari temuan pemakaian nyata, bukan dari daftar fitur.

## POC (v0) — seluruh siklus, versi tipis ✅

| # | Kemampuan | Rujukan |
| :--- | :--- | :--- |
| P1 | Intake engagement dengan *decision first* + triase Mode 1–4 | `/seed`, Slide 8 & 12 |
| P2 | Kanvas scope: problem, keputusan, sponsor, domain owner, irisan B-D-A-T, risiko | Slide 8 |
| P3 | Stage-gate per mode dengan checklist kriteria keluar dan pencatatan penyetuju (RACI) | Slide 6–11, 13 |
| P4 | ADR log (Proposed → Accepted/Rejected/Superseded) | Slide 10, SOP O-S313-04 |
| P5 | Register artefak dengan aturan *No Orphan* | Prinsip 5, R-S313-04 |
| P6 | Backlog `/foundation` yang diisi lessons learned dari `/harvest` | Slide 6 (feedback loop) |
| P7 | Dashboard: perlu perhatian, pipeline, kapasitas per mode, jejak dampak | TOGAF Modul 08 |
| P8 | Playbook di dalam aplikasi (prinsip, mode, RACI) dari `playbook.json` | Prinsip desain 1 |
| P9 | Jurnal/timeline per engagement + ekspor JSON (backup) | Configuration Mgmt |
| P10 | **Katalog Produk EA + resep kerja** (langkah, level ketinggian, template, "Mulai di sini", ADR shortcut, pengingat artefak tertinggal) | TOGAF EA Services (Modul 05), SOP O-S313-xx |
| P11 | Lessons learned → backlog perbaikan resep per produk | Project Cultivates, EA Harvests |
| P12 | **Pembuatan Produk EA**: editor spesifikasi, metode (langkah dipetakan ke tahap Planting Seed), template Markdown, tools, serta penyerapan masukan perbaikan. Produk disimpan di DB | TOGAF EA Practice Development (Modul 05 #6) |

| P13 | **Dokumen deliverable dinamis** (ADR-003/004): Standar Struktur Deliverable, katalog produk sebagai spesifikasi deliverable, Klasifikasi Informasi, Skema Kode Dokumen, Isu & Asumsi, snapshot saat gerbang | Data tata kelola tidak diketik ulang |

## Temuan pemakaian (masukan untuk S1)

- **2026-10-28 · ENG-2026-001:** gerbang `/cultivate` dan `/harvest` bisa dilewati dalam 30 detik tanpa ADR atau artefak, karena kriteria gerbang hanya berupa centang mandiri. Kandidat perbaikan: kriteria tertentu terhubung ke bukti (mis. "ADR disahkan" baru bisa dicentang jika ada ADR Accepted). Kandidat lain: versi produk dicatat pada engagement saat dibuat, supaya resep yang dipakai bisa ditelusuri.

## Kandidat sprint (diprioritaskan ulang setelah review POC)

Platform implementasi: **Odoo Community custom module** (ADR-001). POC tetap scratch.

| Sprint | Tema | Hipotesis yang diuji |
| :--- | :--- | :--- |
| S1 | **Review POC + desain modul Odoo** | Alur intake → harvest terasa alami untuk 3–5 engagement nyata. Hasilnya: daftar UX esensial dan spesifikasi model Odoo (ADR-001) |
| S2 ✅ | **Modul Odoo `ea_desk` v1**: setara POC (engagement, gerbang, ADR, artefak, foundation, produk & resep, chatter). Lihat ADR-002 | Pindah platform tanpa kehilangan alur kerja |
| S3 | **Laporan berkala** (ringkasan bulanan untuk atasan / Architecture Board) | Jejak dampak membantu membuktikan nilai EA |
| S4 | **Katalog pihak** (Sponsor/Domain Owner sebagai entitas) + peta stakeholder | Pola keterlibatan stakeholder perlu dilihat lintas engagement |
| S5 | **Dispensasi & Compliance review** (Phase G) sebagai objek tersendiri | Mode 3 Gatekeeper cukup sering hingga butuh alur sendiri |
| S6 | **Akses Sponsor** (user portal/internal Odoo) | Sponsor mau melihat status sendiri tanpa ditanya |
| — | ~~Editor playbook di UI~~ | Gratis di Odoo: mode, tahap, dan kriteria menjadi data konfigurasi |

## Definition of Done (setiap sprint)

- Uji otomatis (`npm test`) lulus.
- Dipakai pada minimal satu engagement nyata.
- `VISION.md` diperbarui jika ada perubahan batas solusi.
