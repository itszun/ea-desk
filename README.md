# EA Desk

> **Implementasi utama: Odoo 18** → [`odoo/README.md`](odoo/README.md) · keputusan: [`docs/adr/ADR-002-odoo-implementation.md`](docs/adr/ADR-002-odoo-implementation.md).
> Folder root berisi **POC** (Node) yang tetap berjalan untuk review lewat `https://ea.weiwu.my.id/_poc`.

## POC

Sistem manajemen kerja fungsi Enterprise Architecture. Siklus *Planting Seed* (`/seed → /sprout → /cultivate → /harvest`), 4 Mode EA, ADR, dan register artefak *No Orphan*. Bukan tool pemodelan EA.

- Visi & batas solusi: [`docs/VISION.md`](docs/VISION.md)
- Backlog & sprint: [`docs/BACKLOG.md`](docs/BACKLOG.md)
- Keputusan platform: [`docs/adr/ADR-001-platform.md`](docs/adr/ADR-001-platform.md). POC dibangun scratch, implementasi pakai Odoo Community module.
- Operating model (bisa diubah tanpa menyentuh kode): [`playbook.json`](playbook.json)

## Menjalankan

```bash
npm start            # http://127.0.0.1:8090 (PORT, HOST, DB_FILE bisa diatur via env)
npm test             # uji aturan inti (node:test)
```

Butuh Node.js ≥ 24 (memakai `node:sqlite`). Tidak ada dependensi npm. Data disimpan di `data/ea-desk.db`; backup lewat menu "Ekspor backup JSON" atau dengan menyalin file DB.

## Deploy di server ini

1. Service (systemd user):
   `ln -sf ~/Projects/ea-desk/deploy/ea-desk.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now ea-desk`
2. DNS: A record `ea.weiwu.my.id → 139.190.101.248`.
3. Caddy: tambahkan isi `deploy/Caddyfile.ea` (dengan hash dari `caddy hash-password`) ke `/etc/caddy/Caddyfile`, lalu `sudo systemctl reload caddy`.
