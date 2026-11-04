# ADR-002 — Implementasi Odoo: versi, hosting, dan switching ke POC

- **Status:** Accepted (2026-10-28)
- **Melanjutkan:** ADR-001 (POC scratch → implementasi Odoo Community)

## Context

POC dinilai cocok (UX, konsep Produk EA dan resep kerja, Pembuatan Produk). Pemilik meminta implementasi Odoo di `ea.weiwu.my.id`, dengan kemudahan kembali ke POC untuk review. Batasan server: RAM 3,8 GB (±1,4 GB bebas), Python host 3.14 (tidak didukung Odoo 18), PostgreSQL belum terpasang, Docker sudah dipakai aturcuan, dan Caddy 2.6.2 sebagai reverse proxy.

## Decision

| Aspek | Keputusan | Alasan |
| :--- | :--- | :--- |
| Versi | **Odoo 18.0 Community** (`odoo:18.0`) + PostgreSQL 16 | Versi stabil yang sintaks view-nya (`<list>`, `invisible=`, `<chatter/>`) dikuasai. Upgrade ke versi berikutnya diputuskan terpisah |
| Hosting | Docker Compose di server ini (`odoo/docker-compose.yml`), port 8069 hanya di localhost, `workers=0` | Python host tidak cocok; Docker sudah tersedia; hemat RAM (±250 MB untuk Odoo + DB) |
| Dependensi modul | `base`, `mail` saja (tanpa `project`) | Chatter, activity, dan follower didapat dari `mail`. Domain EA Desk tetap bersih |
| Sumber data awal | `odoo/tools/gen_data.py` menghasilkan XML dari `playbook.json` POC (`noupdate="1"`) | Satu sumber kebenaran. Setelah terpasang, data dimiliki tim EA dan diedit di Odoo |
| Keamanan | Caddy `basicauth` tetap dipertahankan, `list_db=False`, `dbfilter=^ea_desk$`, password acak di `odoo/config/` (0700, di luar git) | Data internal WIKA. Database manager tidak terekspos |
| Switching | Caddy merutekan berdasarkan cookie: `/_poc` → POC (8090), `/_odoo` → Odoo (8069, default). POC tetap berjalan | Berlaku per browser dan instan, tanpa sudo, dan tanpa mematikan salah satu aplikasi. Masuk POC lewat URL `/_poc`; tautan "Kembali ke Odoo" ada di POC |
| Rollback total | `sudo python3 deploy/caddy_ea_switch.py --poc` | Satu perintah untuk mengembalikan situs sepenuhnya ke POC |

### Padanan POC → Odoo

| POC | Odoo |
| :--- | :--- |
| Meja Kerja (dashboard) | Menu **Meja Kerja** (kanban pipeline per tahap, warna per mode, progres gerbang) + **Perlu perhatian** (siap gerbang, lewat target, tanpa aktivitas 14 hari) |
| Kapasitas & jejak dampak | Menu **Laporan** (graph/pivot beban per mode, gerbang per bulan, ADR disahkan) |
| Resep kerja + "Mulai di sini" + template + ADR shortcut | Tab **Tahap aktif** di engagement: daftar langkah (toggle, penanda, tombol Template / Daftarkan artefak / Buat ADR) terpisah dari kriteria gerbang |
| Jurnal | Chatter (`mail.thread`) + activity untuk tindak lanjut |
| Pembuatan Produk | Menu **Produk EA → Pembuatan Produk** (grup Enterprise Architect) |
| `playbook.json` (tahap, mode, kriteria, prinsip) | Menu **Konfigurasi** |

## Consequences

- (+) Multi-user, chatter, activity, dan hak akses (Pengguna vs Enterprise Architect) tersedia untuk sprint berikutnya, misalnya akses Sponsor.
- (+) POC tetap hidup sebagai alat review UX tanpa biaya tambahan.
- (−) Dua lapis login (basic auth + login Odoo). Bisa disederhanakan saat Sponsor mulai diberi akun.
- (−) Dashboard Odoo memakai view standar (kanban/graph), belum setara Meja Kerja POC. Dashboard OWL custom hanya dibangun jika terbukti perlu.
- (−) Data POC (ENG-2026-001 yang sudah ditutup) tidak dimigrasi. Backup JSON-nya tetap tersedia lewat POC.
- Tes modul dijalankan di DB terpisah (`odoo/tools/test.sh` → `ea_test`) supaya penomoran ENG/ADR produksi tidak terpakai.
