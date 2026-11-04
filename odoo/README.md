# EA Desk — Odoo 18 Community

Modul `ea_desk` (di `addons/ea_desk`) adalah implementasi EA Desk di Odoo. POC (Node, di root repo) tetap berjalan untuk review. Keputusan desain: [`../docs/adr/ADR-002-odoo-implementation.md`](../docs/adr/ADR-002-odoo-implementation.md).

## Operasional

Semua perintah dijalankan dari folder `odoo/`. Kalau shell belum memuat grup `docker`, awali dengan `sg docker -c "…"`.

| Tugas | Perintah |
| :--- | :--- |
| Siapkan konfigurasi & password (sekali) | `./tools/init_config.sh` |
| Jalankan / hentikan | `docker compose up -d` / `docker compose stop` |
| Log | `docker compose logs -f odoo` |
| Instal modul pertama kali | `docker compose run --rm odoo odoo -d ea_desk -i ea_desk --stop-after-init` |
| Upgrade modul setelah ubah kode | `docker compose stop odoo && docker compose run --rm odoo odoo -d ea_desk -u ea_desk --stop-after-init && docker compose up -d odoo` |
| Tes (DB terpisah `ea_test`) | `./tools/test.sh` |
| Backup DB + filestore | `./tools/backup.sh` → `backups/<waktu>/` |
| Regenerasi data awal dari `playbook.json` | `python3 tools/gen_data.py` (hanya berlaku untuk instalasi baru, karena data memakai `noupdate`) |

Login: `malik`. Password ada di `config/admin_password` (baca dengan `cat`, jangan dibagikan). Master password database ada di `config/master_password`.

## Switching POC ↔ Odoo

| Ingin | Caranya |
| :--- | :--- |
| Review POC di browser ini | Buka `https://ea.weiwu.my.id/_poc` |
| Kembali ke Odoo | Tautan **Kembali ke EA Desk (Odoo)** di POC, atau buka `/_odoo` |
| Pasang/pulihkan rute switching di Caddy | `sudo python3 deploy/caddy_ea_switch.py` (dari root repo) |
| Rollback total: seluruh situs → POC | `sudo python3 deploy/caddy_ea_switch.py --poc` |

## Struktur modul

| Model | Isi |
| :--- | :--- |
| `ea.stage`, `ea.mode`, `ea.gate.criterion`, `ea.principle` | Tata kelola Planting Seed (menu Konfigurasi) |
| `ea.product` (+ `.step`, `.template`, `.tool`) | Produk EA dan metodenya. Langkah tanpa produk = resep umum |
| `ea.engagement` (+ `.line`, `ea.gate.pass`) | Engagement, checklist per tahap (kriteria gerbang & langkah resep), riwayat gerbang |
| `ea.decision` | ADR |
| `ea.artifact` | Register artefak (No Orphan) |
| `ea.foundation.item` | Backlog /foundation dan masukan perbaikan resep |
| `ea.gate.wizard` | Dialog lewati gerbang + lessons learned |
| `ea.template.preview` | Pratinjau template sebagai textarea (salin/unduh .md; tidak mengubah template) |
| `get_executive_summary()` + `static/src/dashboard` | Dashboard **Ringkasan Eksekutif** (OWL + Chart.js), halaman awal setelah login |

| `ea.document.renderer`, `ea.document.wizard` | Penyusun dokumen deliverable dari Standar Struktur Deliverable (ADR-003/004): validasi sumber, kode dokumen, snapshot saat gerbang |
| `ea.info.classification`, `ea.document.scheme` | Reference data: Klasifikasi Informasi, Skema Kode Dokumen (menu Konfigurasi) |
| `ea.issue` | Isu & Asumsi (ISU-NNN), dapat dijadikan ADR |
| `ea.product.content` | Konten baku produk (token `{{konten:kode}}`) |

Tema: hijau primer `#1f7a52`, aksen oranye (`static/src/scss`). Batas kapasitas: parameter sistem `ea_desk.capacity_limit` (default 8).
