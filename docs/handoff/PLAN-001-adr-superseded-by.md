# PLAN-001 — Rantai supersede ADR ("digantikan oleh")

| Ukuran | S (target < 10 menit) | Branch | `feat/adr-superseded-by` | Status | Siap dikerjakan |
| :-- | :-- | :-- | :-- | :-- | :-- |

## 1. Tujuan
ADR yang sudah Accepted tidak diedit, tetapi di-*supersede* oleh ADR baru. Saat ini status "Superseded" bisa diberikan tanpa menyebut ADR penggantinya, sehingga rantai keputusan putus. Setelah tugas ini:
- ADR hanya bisa ditandai Superseded bila **ADR pengganti** sudah dipilih.
- Form ADR menampilkan **"Digantikan oleh"** dan daftar **"Menggantikan"** (arah sebaliknya).
- Tabel Keputusan di dokumen deliverable menampilkan penggantinya, mis. status `Superseded → ADR-009`.

## 2. Konteks & rujukan
- ADR yang relevan: `docs/adr/ADR-003-sumber-data-dokumen.md`, `docs/adr/ADR-004-standar-struktur-deliverable.md` (bagian Keputusan pada dokumen).
- Baca dulu:
  - `odoo/addons/ea_desk/models/ea_decision.py` (`_decide`, `action_supersede`)
  - `odoo/addons/ea_desk/views/ea_decision_views.xml` (form & list ADR)
  - `odoo/addons/ea_desk/models/ea_document.py`, method `_block_keputusan`
  - `odoo/addons/ea_desk/tests/test_ea_desk.py`, khususnya `test_adr_needs_decider_and_decision` (gaya tes)
- Konvensi: Odoo 18 (`<list>`, atribut `invisible="…"`, tanpa `attrs`); label dan pesan error dalam Bahasa Indonesia; ikuti gaya kode sekitar.

## 3. Batas scope
**Boleh diubah:**
- `odoo/addons/ea_desk/models/ea_decision.py`
- `odoo/addons/ea_desk/views/ea_decision_views.xml`
- `odoo/addons/ea_desk/models/ea_document.py` (hanya `_block_keputusan`)
- `odoo/addons/ea_desk/tests/test_ea_desk.py` (tambah tes di akhir kelas)
- `docs/handoff/LOG-001-adr-superseded-by.md` (baru)

**Tidak boleh disentuh:** file lain, termasuk `__manifest__.py` (versi modul tidak perlu dinaikkan untuk tugas ini), data XML, security CSV, POC Node, dan `odoo/config/`.

## 4. Langkah yang diharapkan
1. **Model** `ea.decision`:
   - `superseded_by_id = fields.Many2one('ea.decision', 'Digantikan oleh', copy=False, tracking=True)` dengan domain yang mencegah memilih dirinya sendiri.
   - `supersedes_ids = fields.One2many('ea.decision', 'superseded_by_id', 'Menggantikan')`.
   - `action_supersede`: tetap hanya untuk ADR Accepted. Bila `superseded_by_id` kosong, munculkan `UserError` berbahasa Indonesia ("Pilih ADR pengganti sebelum menandai Superseded."). Bila ADR pengganti = dirinya sendiri, munculkan error.
   - Saat superseded, posting pesan chatter di ADR lama (dan di engagement-nya, mengikuti pola `_decide`) yang menyebut kode ADR pengganti.
2. **View** form ADR:
   - Field `superseded_by_id` tampil di grup kanan, editable saat state Accepted, dan readonly setelah Superseded.
   - Daftar `supersedes_ids` (kode, judul, status) tampil read-only, hanya bila tidak kosong.
3. **Dokumen** (`_block_keputusan`): untuk ADR Superseded yang punya pengganti, kolom Status berisi `Superseded → <kode pengganti>`.
4. **Tes** baru (nama bebas, mis. `test_adr_supersede_chain`):
   - Supersede tanpa pengganti → `UserError`.
   - Supersede dengan dirinya sendiri sebagai pengganti → error.
   - Rantai valid: ADR lama `superseded`, `old.superseded_by_id == new`, dan `new.supersedes_ids` berisi ADR lama.
   - Dokumen: setelah `ea.document.renderer.render(...)` (lihat pola di `test_generate_document`), isinya memuat `Superseded → <kode pengganti>`.

## 5. Kriteria selesai
- [ ] `sg docker -c "odoo/tools/test.sh"` → `0 failed, 0 error(s)`, dengan jumlah tes **24 atau lebih** (sebelumnya 23). Tempel baris hasil aslinya di LOG.
- [ ] `python3 -c "import ast; ast.parse(open('odoo/addons/ea_desk/models/ea_decision.py').read())"` lulus.
- [ ] Cek UI (Claude saat review): form ADR menampilkan "Digantikan oleh" dan "Menggantikan", dan tombol Superseded menolak bila pengganti kosong.

## 6. Larangan (selalu berlaku)
- Patuhi `~/governance/rules/SERVER_RULES.md` dan `~/governance/protocols/hitl_action_matrix.md`.
- **Tanpa aksi Tier 3:** sudo, `rm -rf`, `git reset --hard`, `git push`, membaca `.env`/secret/`odoo/config/*`, mengubah Caddy atau firewall. Bila butuh, tulis di LOG lalu berhenti.
- **Tanpa produksi Odoo:** jangan sentuh database `ea_desk`. Jangan menjalankan `docker compose up/stop/restart` atau upgrade modul. Tes hanya lewat `odoo/tools/test.sh`.
- **Tanpa `git commit` dan `git push`.** Kerja di branch `feat/adr-superseded-by` (sudah disiapkan reviewer). Biarkan perubahan sebagai working tree.
- Jangan mengubah file di luar daftar "Boleh diubah" tanpa menuliskan alasannya di LOG.
- Jangan membuat keputusan desain baru. Bila ragu, pilih opsi paling sederhana yang konsisten dengan kode sekitar, lalu catat di LOG.

## 7. Keluaran
Tulis `docs/handoff/LOG-001-adr-superseded-by.md` dari `_TEMPLATE_LOG.md`.
