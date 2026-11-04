# PLAN-002 — Tanggal pengesahan ADR tidak boleh tertimpa saat supersede

| Ukuran | S (target < 10 menit) | Branch | `feat/adr-superseded-date` | Status | Siap dikerjakan |
| :-- | :-- | :-- | :-- | :-- | :-- |

## 1. Tujuan
Temuan dari review LOG-001: saat ADR Accepted di-*supersede*, `_decide('superseded')` menimpa `decided_date` dengan waktu supersede, sehingga **tanggal pengesahan asli hilang**. Ini merusak jejak audit, karena tidak ada lagi bukti kapan keputusan itu berlaku.

Hasil yang diharapkan:
- `decided_date` tetap berisi waktu ADR diputuskan (Accepted/Rejected).
- Waktu supersede tercatat terpisah dan terlihat di form ADR.
- Perilaku lain dari PLAN-001 tetap sama: pengganti wajib dipilih, dan pesan chatter tetap dikirim.

Cara teknisnya kamu tentukan sendiri (misalnya field baru untuk waktu supersede), selama mengikuti gaya kode sekitar dan kerangka risiko di bawah.

## 2. Konteks & rujukan
- `docs/handoff/LOG-001-adr-superseded-by.md` (bagian Review → Catatan).
- `odoo/addons/ea_desk/models/ea_decision.py` (`_decide`, `action_supersede`)
- `odoo/addons/ea_desk/views/ea_decision_views.xml`
- `odoo/addons/ea_desk/tests/test_ea_desk.py` (`test_adr_supersede_chain` dan `test_adr_needs_decider_and_decision`)
- `docs/handoff/README.md` → **Manajemen risiko oleh agy** (R1/R2/R3, perbaikan mandiri, self-review). **Wajib diikuti dalam tugas ini.**

## 3. Batas scope
**Boleh diubah:** `odoo/addons/ea_desk/models/ea_decision.py`, `odoo/addons/ea_desk/views/ea_decision_views.xml`, `odoo/addons/ea_desk/tests/test_ea_desk.py`, dan `docs/handoff/LOG-002-adr-superseded-date.md` (baru).

Perbaikan mandiri **R2** di file lain dalam modul `ea_desk` boleh dilakukan bila kamu menemukan cacat yang berkaitan, dengan aturan di README handoff.

**Tidak boleh disentuh:** `~/Projects/ea-desk-release`, `~/.config/ea-desk/`, `__manifest__.py` (versi tidak perlu naik), security CSV, dan POC Node.

## 4. Kriteria selesai
- [ ] LOG memuat **penilaian risiko** (tabel) sebelum ringkasan pekerjaan, termasuk dampak ke data produksi.
- [ ] Tes baru membuktikan bahwa `decided_date` **sama persis** sebelum dan sesudah supersede, dan waktu supersede terisi.
- [ ] `sg docker -c "odoo/tools/test.sh"` → `0 failed, 0 error(s)`, minimal 25 tes. Tempel output aslinya.
- [ ] Self-review dicentang di LOG, termasuk `git -C ~/Projects/ea-desk-release status` bersih.
- [ ] Cek UI (Claude saat review): form ADR yang superseded menampilkan tanggal keputusan asli dan waktu supersede.

## 5. Larangan (selalu berlaku)
- Patuhi `~/governance/rules/SERVER_RULES.md` dan `~/governance/protocols/hitl_action_matrix.md`.
- **Tanpa aksi Tier 3:** sudo, `rm -rf`, `git reset --hard`, `git push`, membaca `.env`/secret/`~/.config/ea-desk/*`, mengubah Caddy atau firewall.
- **Tanpa produksi:** jangan sentuh database `ea_desk`, `~/Projects/ea-desk-release`, atau container `ea-desk-*` (kecuali yang dibuat `odoo/tools/test.sh`).
- **Tanpa `git commit` dan `git push`.** Kerja di branch `feat/adr-superseded-date` (sudah disiapkan reviewer).
- Perubahan **R3** tidak dikerjakan: tulis sebagai temuan di LOG.

## 6a. Risiko yang sudah diketahui reviewer
- **Data produksi:** per 29-10-2026, database produksi berisi 8 ADR, semuanya Proposed, dan **0 berstatus Superseded**. Belum ada `decided_date` yang rusak di produksi, jadi tidak ada data lama yang perlu diperbaiki. Bila kamu menambah field baru, pastikan record lama tetap valid dengan nilai kosong.
- **Pesan chatter:** pola posting dari PLAN-001 harus tetap terjaga, karena tes lama mengandalkannya secara tidak langsung.

## 7. Keluaran
Tulis `docs/handoff/LOG-002-adr-superseded-date.md` dari `_TEMPLATE_LOG.md` (template terbaru, dengan bagian risiko).
