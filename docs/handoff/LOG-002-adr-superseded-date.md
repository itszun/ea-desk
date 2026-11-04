# LOG-002 — Tanggal pengesahan ADR tidak boleh tertimpa saat supersede

| PLAN | `PLAN-002-adr-superseded-date.md` | Implementer | agy (Gemini 3.8 Flash) | Tanggal | 2026-10-29 |
| :-- | :-- | :-- | :-- | :-- | :-- |

## Putaran 1

### Penilaian risiko (sebelum mengubah kode)
| Risiko | Tingkat (R1/R2/R3) | Dampak ke data produksi | Mitigasi |
| :-- | :-- | :-- | :-- |
| Penambahan field `superseded_date` dan pemisahan timestamp keputusan vs supersede pada `ea.decision` | R2 (Sedang) | Database produksi per 29-10-2026 memiliki 8 ADR (semuanya Proposed, 0 Superseded). Belum ada `decided_date` rusak di produksi. Field baru bernilai NULL pada record yang ada sehingga tidak memerlukan migrasi data skema/tabel. | Field didefinisikan dengan `readonly=True` dan `copy=False`. Logika `_decide` hanya menulis `superseded_date` saat status `superseded` dan mempertahankan `decided_date`. View menyembunyikan field saat `state != 'superseded'`. Diuji dengan unit test komprehensif. |

### Ringkasan yang dikerjakan
- **Model `ea.decision`**:
  - Menambahkan field `superseded_date = fields.Datetime('Tanggal supersede', readonly=True, copy=False)`.
  - Memperbarui `_decide`: saat `state == 'superseded'`, mencatat waktu sekarang ke field `superseded_date` dan mempertahankan `decided_date` asli (tidak menimpanya). Untuk state lainnya (`accepted` / `rejected`), waktu sekarang tetap dicatat ke `decided_date`.
- **View Form `ea.decision`**:
  - Menambahkan `<field name="superseded_date" invisible="state != 'superseded'"/>` di bawah `superseded_by_id` pada grup keputusan.
- **Unit Test**:
  - Memperbarui method `test_adr_supersede_chain` di `odoo/addons/ea_desk/tests/test_ea_desk.py` untuk memvalidasi bahwa `decided_date` sebelum dan sesudah supersede bernilai identik dan `superseded_date` terisi.
  - Menambahkan method tes baru `test_adr_supersede_preserves_decided_date` yang secara eksplisit membuktikan persistensi `decided_date` asli dan pencatatan terpisah `superseded_date`. Total tes Odoo bertambah dari 24 menjadi 25 tes.

### File yang diubah
| File | Perubahan |
| :-- | :-- |
| `odoo/addons/ea_desk/models/ea_decision.py` | Penambahan field `superseded_date` dan pemisahan penulisan timestamp di `_decide`. |
| `odoo/addons/ea_desk/views/ea_decision_views.xml` | Penambahan `superseded_date` dengan kondisi `invisible="state != 'superseded'"`. |
| `odoo/addons/ea_desk/tests/test_ea_desk.py` | Penambahan asersi di `test_adr_supersede_chain` dan penambahan test case `test_adr_supersede_preserves_decided_date`. |
| `docs/handoff/LOG-002-adr-superseded-date.md` | Dokumen LOG implementasi dan hasil verifikasi. |

### Keputusan kecil & alasannya
- **Label field `superseded_date`**: Dipilih `'Tanggal supersede'`, selaras dengan terminologi status "Superseded", tombol "Tandai Superseded", dan field `'Tanggal keputusan'`.
- **Visibilitas di Form View**: Menggunakan `invisible="state != 'superseded'"` agar field hanya terlihat ketika ADR berstatus Superseded, menjaga form tetap rapi tanpa kolom kosong saat record masih Proposed, Accepted, atau Rejected.

### Hasil tes (output asli, tidak diringkas)
Perintah Odoo: `sg docker -c "odoo/tools/test.sh"`
```
2026-10-29 07:02:30,723 1 INFO ea_test odoo.tests.result: 0 failed, 0 error(s) of 25 tests when loading database 'ea_test' 
```

AST check:
```
python3 -c "import ast; ast.parse(open('odoo/addons/ea_desk/models/ea_decision.py').read())"
python3 -c "import ast; ast.parse(open('odoo/addons/ea_desk/tests/test_ea_desk.py').read())"
```
*(Exit code 0, tanpa output / syntax valid)*

POC Node test (`npm test`):
```
> ea-desk@0.1.0 test
> node --test

✔ engagement requires a decision and a sponsor (Decision First) (102.597936ms)
✔ gate is blocked until exit criteria are met (85.16341ms)
✔ Gatekeeper mode skips /sprout and uses the compliance checklist (39.641247ms)
✔ mode is locked after /seed (64.122698ms)
✔ artifacts must have owner, consumer and purpose (No Orphan) (15.044931ms)
✔ ADR needs a decider and decision text before acceptance (23.674499ms)
✔ full cycle closes at /harvest, harvests artifacts and feeds /foundation (126.992716ms)
✔ dashboard flags engagements ready for a gate (32.865493ms)
✔ engagement follows its product recipe and falls back to default steps (18.295181ms)
✔ lessons learned improve the product recipe (86.980062ms)
✔ templates are served as markdown (3.249895ms)
✔ recipe steps can be ticked without counting toward the gate (10.191982ms)
✔ products can be created and edited; method steps map to Planting Seed stages (33.431635ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 943.391585
```

### Perbaikan mandiri (R2)
| Cacat yang ditemukan | Perbaikan | Tes yang membuktikan |
| :-- | :-- | :-- |
| `_decide('superseded')` menimpa field `decided_date` dengan waktu supersede, menghilangkan jejak audit kapan keputusan semula disahkan | Menambahkan field `superseded_date` dan memodifikasi `_decide` agar hanya memperbarui `superseded_date` saat status superseded, sehingga `decided_date` asli dipertahankan | `test_adr_supersede_preserves_decided_date` dan `test_adr_supersede_chain` di `odoo/addons/ea_desk/tests/test_ea_desk.py` |

### Temuan yang tidak dikerjakan (R3) & usulan PLAN
- Tidak ada temuan R3 pada putaran ini.

### Self-review
- [x] `git diff` dibaca ulang; tidak ada file di luar scope tanpa alasan
- [x] Tes lulus (output di atas, 25 tes)
- [x] `git -C ~/Projects/ea-desk-release status` bersih; produksi tidak disentuh

### Ragu / belum selesai
- Tidak ada. Seluruh kriteria penerimaan dari PLAN-002 telah terpenuhi.

### Pertanyaan untuk reviewer
- Tidak ada.

---

## Review (diisi Claude)
**Putusan:** ✅ Diterima (putaran 1, tanpa revisi)

**Yang diperiksa:**
- **Scope & produksi:** hanya 3 file yang diizinkan ditambah LOG. Snapshot produksi sebelum dan sesudah identik. Worktree rilis bersih (sama dengan self-review agy).
- **`git diff`:** perbaikan minimal dan tepat (`decided_date` hanya ditulis untuk Accepted/Rejected, `superseded_date` untuk Superseded). Pola chatter dari PLAN-001 tetap utuh.
- **Tes (reviewer):** `odoo/tools/test.sh` → `0 failed, 0 error(s) of 25 tests`.
- **UI** (`docker-compose.dev.yml`, `ea_test`): ADR yang di-supersede menampilkan *Tanggal keputusan* 14:05:47 (tidak berubah) dan *Tanggal supersede* 14:05:49. Data via RPC: `decided_date` sama persis sebelum dan sesudah supersede.

**Catatan untuk penilaian risiko berikutnya:**
- **Pemakai field yang diubah perlu dipetakan.** `decided_date` dipakai juga oleh dashboard (jejak dampak 90 hari, filter "Diputuskan 90 hari terakhir") dan oleh tabel Keputusan di dokumen deliverable. Perubahan ini kebetulan membuat keduanya benar, tetapi penilaian risiko seharusnya menyebutkannya. Pada tugas berikutnya, cari dulu semua pemakai field yang perilakunya berubah (`grep`), lalu cantumkan dampaknya.
- **Kategori:** isi PLAN adalah R1. "Perbaikan mandiri (R2)" khusus untuk cacat yang ditemukan sendiri di luar isi PLAN.

**Temuan lingkungan (bukan dari agy, sudah diperbaiki reviewer):** setelah pemisahan produksi, `ea_test` masih merujuk ke file asset di filestore lama, sehingga web client dev tampil kosong. Rujukan asset di `ea_test` dihapus agar dibuat ulang. Masalah ini sekali saja, karena filestore dev kini persisten.
