# Project: EA Desk

Sistem manajemen kerja fungsi Enterprise Architecture. POC Node di root; implementasi utama modul Odoo 18 di `odoo/addons/ea_desk`. Lihat `README.md`, `odoo/README.md`, dan `docs/adr/`.

## Aturan untuk agent (Antigravity, Codex, dan lainnya)
- Server rules berlaku dan lebih tinggi dari aturan proyek: `~/governance/rules/SERVER_RULES.md` dan `~/governance/protocols/hitl_action_matrix.md`.
- Pekerjaan implementasi mengikuti alur handoff di `docs/handoff/README.md`: kerjakan hanya yang ada di PLAN yang ditunjuk, lalu tulis LOG-nya.
- Tanpa aksi Tier 3 (sudo, `rm -rf`, `git reset --hard`, `git push`, membaca `.env`/secret/`odoo/config/*`, mengubah Caddy/firewall).
- **Jangan pernah mengubah `~/Projects/ea-desk-release`** (worktree produksi) atau `~/.config/ea-desk/` (konfigurasi & password). Kerja hanya di `~/Projects/ea-desk`.
- Jangan menyentuh produksi Odoo (database `ea_desk`, `docker compose up/stop/restart`, upgrade modul). Tes Odoo hanya lewat `sg docker -c "odoo/tools/test.sh"` (database `ea_test`).
- Jangan commit atau push. Reviewer (Claude) yang melakukan commit setelah review.
- UI berbahasa Indonesia. Ikuti gaya kode di sekitarnya.
