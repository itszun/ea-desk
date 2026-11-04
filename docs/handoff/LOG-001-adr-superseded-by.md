# LOG-001 — Rantai supersede ADR ("digantikan oleh")

| PLAN | `PLAN-001-adr-superseded-by.md` | Implementer | agy (Gemini 3.8 Flash) | Tanggal | 2026-10-29 |
| :-- | :-- | :-- | :-- | :-- | :-- |

## Putaran 1

### Ringkasan yang dikerjakan
- **Model `ea.decision`**:
  - Menambahkan field `superseded_by_id` (`Many2one` ke `ea.decision`, label "Digantikan oleh", `copy=False`, `tracking=True`, dengan domain `[('id', '!=', id)]`).
  - Menambahkan field `supersedes_ids` (`One2many` ke `ea.decision` via `superseded_by_id`, label "Menggantikan").
  - Memperbarui `action_supersede`: memvalidasi `state == 'accepted'`, memastikan `superseded_by_id` telah diisi (UserError: "Pilih ADR pengganti sebelum menandai Superseded."), serta menolak bila menunjuk dirinya sendiri (UserError: "ADR tidak bisa menggantikan dirinya sendiri.").
  - Memperbarui `_decide`: saat state `superseded`, memposting chatter pada ADR lama (`d.message_post`) dan engagement terkait (`d.engagement_id.message_post`) yang menyebutkan kode ADR pengganti.
- **View Form `ea.decision`**:
  - Menempatkan `superseded_by_id` di grup kanan formulir dengan `readonly="state != 'accepted'"`.
  - Menambahkan grup "Menggantikan" dengan daftar `supersedes_ids` (kode, judul, status badge), `readonly="1"`, dan `invisible="not supersedes_ids"`.
- **Dokumen Deliverable (`_block_keputusan`)**:
  - Mengubah kolom Status pada tabel Keputusan sehingga untuk ADR superseded yang memiliki pengganti menampilkan format `Superseded → <kode pengganti>`.
- **Unit Test**:
  - Menambahkan method `test_adr_supersede_chain` di `odoo/addons/ea_desk/tests/test_ea_desk.py` yang mencakup:
    1. Error saat supersede tanpa ADR pengganti.
    2. Error saat supersede dengan pengganti dirinya sendiri.
    3. Rantai supersede valid (status menjadi superseded, `old.superseded_by_id == new`, dan `old` masuk ke `new.supersedes_ids`).
    4. Render dokumen memuat teks `Superseded → <kode pengganti>`.

### File yang diubah
| File | Perubahan |
| :-- | :-- |
| `odoo/addons/ea_desk/models/ea_decision.py` | Penambahan field `superseded_by_id`, `supersedes_ids`, validasi supersede, dan posting pesan chatter. |
| `odoo/addons/ea_desk/views/ea_decision_views.xml` | Penambahan field `superseded_by_id` dan tabel `supersedes_ids` pada form view. |
| `odoo/addons/ea_desk/models/ea_document.py` | Penyesuaian `_block_keputusan` untuk menampilkan `Superseded → <kode pengganti>`. |
| `odoo/addons/ea_desk/tests/test_ea_desk.py` | Penambahan method tes `test_adr_supersede_chain`. |

### Keputusan kecil & alasannya
- **Format pesan chatter supersede**: Menggunakan string `_('%(code)s digantikan oleh %(replacement)s', code=d.code, replacement=d.superseded_by_id.code)` yang diposting ke record ADR lama dan ke engagement-nya, selaras dengan konvensi notifikasi `create` dan `_decide` yang sudah ada di model.
- **Filter domain `superseded_by_id`**: Menggunakan `[('id', '!=', id)]` di level field definition sehingga web client Odoo otomatis menyaring record yang sedang dibuka dari dropdown pilihan pengganti.
- **Tampilan daftar `supersedes_ids`**: Diberi widget badge dengan decoration status yang konsisten dengan list view `ea.decision`.

### Hasil tes (output asli, tidak diringkas)
Perintah: `sg docker -c "odoo/tools/test.sh"`
```
2026-10-29 05:44:47,244 1 INFO ea_test odoo.tests.result: 0 failed, 0 error(s) of 24 tests when loading database 'ea_test' 
```

AST check:
```
python3 -c "import ast; ast.parse(open('odoo/addons/ea_desk/models/ea_decision.py').read())"
```
*(Exit code 0, tanpa output / syntax valid)*

POC Node test (`npm test`):
```
> ea-desk@0.1.0 test
> node --test

✔ engagement requires a decision and a sponsor (Decision First) (137.009725ms)
✔ gate is blocked until exit criteria are met (79.517359ms)
✔ Gatekeeper mode skips /sprout and uses the compliance checklist (44.093236ms)
✔ mode is locked after /seed (74.130134ms)
✔ artifacts must have owner, consumer and purpose (No Orphan) (15.291672ms)
✔ ADR needs a decider and decision text before acceptance (21.847222ms)
✔ full cycle closes at /harvest, harvests artifacts and feeds /foundation (150.940398ms)
✔ dashboard flags engagements ready for a gate (37.89461ms)
✔ engagement follows its product recipe and falls back to default steps (19.498135ms)
✔ lessons learned improve the product recipe (101.640869ms)
✔ templates are served as markdown (4.295587ms)
✔ recipe steps can be ticked without counting toward the gate (13.397001ms)
✔ products can be created and edited; method steps map to Planting Seed stages (38.261572ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1148.281381
```

### Ragu / belum selesai
- Tidak ada. Seluruh kriteria penerimaan dari PLAN-001 telah terpenuhi.

### Pertanyaan untuk reviewer
- Tidak ada.

---

## Review (diisi Claude)
**Putusan:** ✅ Diterima (putaran 1, tanpa revisi)

**Yang diperiksa:**
- **Batas scope:** `git status` hanya memuat 4 file yang diizinkan ditambah LOG ini. Tidak ada commit, push, atau file di luar daftar.
- **Produksi:** snapshot `ea_desk` sebelum dan sesudah sama (versi modul 18.0.1.3.0, 8 ADR, 9 isu, `write_date` terakhir tidak berubah). Container produksi tidak di-restart.
- **`git diff`:** sesuai langkah 1–4. Gaya kode konsisten. Pesan error berbahasa Indonesia. Domain `[('id', '!=', id)]` mencegah memilih diri sendiri di UI, dan validasi server tetap ada.
- **Tes (dijalankan reviewer):** `odoo/tools/test.sh` → `0 failed, 0 error(s) of 24 tests`; `npm test` → 13/13; AST ok. Hasilnya cocok dengan klaim LOG.
- **UI** (Odoo sementara port 8070 di database `ea_test`):
  - field "Digantikan oleh" editable saat Accepted;
  - supersede tanpa pengganti ditolak ("Pilih ADR pengganti sebelum menandai Superseded.");
  - setelah supersede status menjadi Superseded dan field terkunci;
  - ADR pengganti menampilkan daftar "Menggantikan".

**Catatan:**
- **Di luar scope, bukan kesalahan agy:** `_decide` menimpa `decided_date` saat supersede, sehingga tanggal pengesahan asli hilang. Kandidat PLAN berikutnya: pisahkan `superseded_date` dari `decided_date`.
- **Kosmetik:** badge status "Superseded" di daftar "Menggantikan" tidak berwarna. Ini konsisten dengan list ADR yang ada, jadi tidak perlu diubah.
- **Risiko alur kerja (untuk README handoff):** container produksi me-mount `odoo/addons` dari working tree yang sama dengan tempat agy bekerja. Kode yang belum direview sudah ada di disk produksi; kalau container restart sebelum upgrade, Python baru termuat tanpa kolom DB yang sesuai.
