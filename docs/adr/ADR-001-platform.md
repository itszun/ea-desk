# ADR-001 — Platform Pengembangan EA Desk

- **Status:** Accepted (2026-10-28)
- **Tanggal:** 2026-10-28
- **Pengambil keputusan:** Abdul Malik Aljun

## Context

EA Desk adalah sistem manajemen kerja fungsi EA (lihat `VISION.md`). Batasan yang menentukan pilihan platform:

1. **Prioritas:** kejelasan visi dan UX alur kerja, bukan banyaknya fitur.
2. **Operating model akan berubah** → tahapan, checklist, dan mode harus mudah diubah (`playbook.json`).
3. **Pengguna:** saat ini 1 orang (EA). Multi-user baru muncul di sprint S3/S5.
4. **Biaya:** token AI dan waktu pemilik terbatas. Pemilik berlatar Laravel.
5. **Infra:** server sudah punya Node 24, Docker (dipakai aturcuan: Laravel + Filament), dan Caddy. PHP tidak terpasang di host.
6. **Status saat ini:** backend versi scratch sudah selesai (±530 baris, 8 tes lulus, menegakkan semua aturan di VISION §5). Frontend belum ada.

## Alternatives Considered

Estimasi token = token output AI (kode + debugging), kasar ±30%. Waktu pemilik = waktu review, uji, dan keputusan, bukan waktu ngoding.

| Kriteria | A. Scratch (Node + Preact, lanjutkan) | B. Laravel Filament | C. Odoo Custom Module | D. No-code (NocoDB/Baserow/Notion) |
| :--- | :--- | :--- | :--- | :--- |
| **Sisa token sampai POC** | ~60–90k (frontend saja) | ~80–120k (tulis ulang: migrasi, model, resource, custom page, Docker) | ~110–160k (model, XML view, security, workflow, Docker Odoo+Postgres) | ~10–20k (desain skema & view) |
| **Token per sprint berikutnya** | 25–45k (semua dibangun manual) | 15–30k (CRUD, filter, auth, ekspor sudah tersedia) | 20–40k (XML verbose, debugging mahal) | 5–10k, tapi segera mentok |
| **Waktu pemilik sampai POC** | 1–2 sesi | 2–3 sesi | 3–5 sesi | 1 sesi |
| **Kualitas UX alur kerja** (stepper gerbang, triase mode, dashboard "perlu perhatian") | ★★★ bebas dirancang | ★★☆ tabel/form bagus; halaman custom via Livewire | ★★☆ kanban + chatter bagus, tampilan terikat Odoo | ★☆☆ tampilan tabel/kanban generik |
| **Penegakan aturan** (decision first, no orphan, gate blocking) | ★★★ sudah jalan | ★★★ validasi + policy | ★★★ constraint + state | ★☆☆ sebagian besar lewat disiplin manual |
| **Proses sebagai konfigurasi** | ★★★ sudah (`playbook.json`) | ★★☆ bisa (config/JSON atau tabel) | ★★☆ bisa (data XML / model konfigurasi) | ★★☆ ubah kolom/opsi |
| **Multi-user, role, audit, notifikasi** (S3/S5) | ★☆☆ bangun sendiri | ★★★ hampir gratis (Shield, notifikasi, activity log) | ★★★ native (users, mail.activity, chatter) | ★★☆ bawaan platform |
| **Bisa dirawat sendiri oleh pemilik** | ★★☆ JS sederhana, tapi bukan stack utama | ★★★ stack yang dikuasai | ★☆☆ kurva belajar Odoo ORM/XML | ★★★ tanpa kode |
| **Beban infra** | Sangat ringan (1 proses, 1 file SQLite) | Sedang (container PHP + DB) | Berat (Odoo + Postgres, ±1–2 GB RAM) | Sedang (self-host) / data di pihak ketiga |
| **Kecocokan strategis WIKA** | Netral | Netral; sama dengan aturcuan | Tinggi **jika** Odoo memang platform strategis WIKA | Rendah (data internal di SaaS) |

## Decision

Diputuskan pemilik pada 2026-10-28:

1. **POC → A (Scratch).** Gunanya menguji operating model (Planting Seed, Mode 1–4, gerbang, ADR, No Orphan) dengan token paling sedikit. Kode POC boleh dibuang. Yang dibawa ke tahap berikutnya adalah pelajaran, skema data, dan `playbook.json`.
2. **Implementasi → C (Odoo Community custom module).** Setelah POC direview (Sprint S1), EA Desk dibangun ulang sebagai modul Odoo.

### Panduan agar POC mudah dipindah ke Odoo

| Konsep POC | Padanan Odoo (rencana) |
| :--- | :--- |
| `engagements` + `stage` | Model `ea.engagement` dengan field `stage_id` (kanban per tahap, seperti `project.task`/`crm.lead`) |
| `playbook.json` (mode, tahap, checklist) | Model konfigurasi `ea.mode`, `ea.stage`, `ea.gate.criterion` + data XML awal |
| `checks`, `gates` | `ea.gate.check`, `ea.gate.pass` (One2many di engagement) |
| `events` (jurnal) | Chatter `mail.thread` + `mail.activity` untuk tindak lanjut |
| `decisions` | `ea.decision` (ADR) dengan state Proposed/Accepted/Rejected/Superseded |
| `artifacts` | `ea.artifact` dengan Owner/Consumer wajib (`required=True`, constraint) |
| `foundation_items` | `ea.foundation.item` |
| Sponsor/Domain Owner (teks) | `res.partner` / `res.users`. Di sini manfaat multi-user Odoo mulai terasa |
| `products` + resep kerja di `playbook.json` | `ea.product` (versi, kematangan, deliverable) + `ea.recipe.step` (tahap, level ketinggian, template sebagai `ir.attachment`). Data ini bisa diedit di UI |
| Dashboard | Kanban + graph/pivot view. Dashboard custom (OWL) hanya jika terbukti perlu |

Yang masih harus diputuskan sebelum S1: versi Odoo (17/18), lokasi hosting (server ini via Docker atau infrastruktur WIKA), dan apakah modul ini bergantung pada `project`.

## Consequences

- (+) POC bisa dipakai paling cepat dengan token paling sedikit. Aturan kerja ditegakkan oleh sistem.
- (−) Kode POC (±60–90k token frontend) dibuang saat pindah ke Odoo. Ini sengaja: POC adalah alat uji, bukan fondasi.
- (−) Implementasi Odoo diperkirakan ~110–160k token sampai setara POC, plus beban infra Odoo + Postgres.
- (+) Implementasi mendapat multi-user, chatter, activity, dan approval bawaan Odoo, dan selaras dengan minat otomasi Odoo.
- Risiko sisa: UX khas POC (stepper gerbang, triase mode) perlu disesuaikan dengan pola view Odoo. Mitigasinya: catat di review S1 mana UX yang esensial dan mana yang hanya nice-to-have.
