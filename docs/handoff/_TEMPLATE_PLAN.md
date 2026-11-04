# PLAN-<NNN> — <judul singkat>

| Ukuran | S / M (target < 15 menit) | Branch | `feat/...` | Status | Siap dikerjakan |
| :-- | :-- | :-- | :-- | :-- | :-- |

## 1. Tujuan
<Satu paragraf: perilaku apa yang harus ada setelah tugas ini selesai, dan untuk siapa.>

## 2. Konteks & rujukan
- ADR terkait: `docs/adr/ADR-00x-…`
- File/kode yang relevan untuk dibaca dulu: …
- Konvensi yang harus diikuti: <gaya kode sekitar, bahasa UI Bahasa Indonesia, Odoo 18 (`<list>`, `invisible=`), dsb.>

## 3. Batas scope
**Boleh diubah:**
- …

**Tidak boleh disentuh:**
- …

## 4. Langkah yang diharapkan
1. …

## 5. Kriteria selesai
- [ ] Tes: <perintah persis> lulus, dengan output asli ditempel di LOG
- [ ] Tes baru: <apa yang harus diuji>
- [ ] Cek UI (dilakukan Claude saat review): …

## 6. Larangan (selalu berlaku)
- Patuhi `~/governance/rules/SERVER_RULES.md` dan `~/governance/protocols/hitl_action_matrix.md`.
- **Tanpa aksi Tier 3:** sudo, `rm -rf`, `git reset --hard`, `git push`, membaca `.env`/secret/`odoo/config/*`, mengubah Caddy atau firewall. Bila butuh, tulis di LOG lalu berhenti.
- **Tanpa produksi Odoo:** jangan sentuh database `ea_desk`. Jangan menjalankan `docker compose up/stop/restart` atau upgrade modul. Tes hanya lewat `odoo/tools/test.sh`.
- **Tanpa `git commit` dan `git push`.** Kerja hanya di branch yang disebut di atas. Biarkan perubahan sebagai working tree untuk direview.
- Jangan mengubah file di luar daftar "Boleh diubah" tanpa menuliskan alasannya di LOG.
- Jangan membuat keputusan desain baru. Bila ragu, pilih opsi paling sederhana yang konsisten dengan kode sekitar, lalu catat di LOG.

## 6a. Risiko yang sudah diketahui reviewer
- <mis. "field baru di model yang sudah punya data produksi: pastikan nilai default aman untuk record lama">

Tingkat risiko (R1/R2/R3) dan aturan perbaikan mandiri: lihat `docs/handoff/README.md` → *Manajemen risiko oleh agy*.

## 7. Keluaran
Tulis `docs/handoff/LOG-<NNN>-<slug>.md` dari `_TEMPLATE_LOG.md`.
