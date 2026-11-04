# Handoff: Claude (perencana & reviewer) ↔ Antigravity `agy` (implementer)

Pekerjaan implementasi di repo ini dikerjakan oleh **agy** berdasarkan rencana dari **Claude**, lalu direview Claude. Keduanya berkomunikasi lewat dokumen di folder ini.

```
Claude: PLAN-<NNN>-<slug>.md  →  agy: implementasi + LOG-<NNN>-<slug>.md  →  Claude: bagian "Review" di LOG
             ↑                                                                  │
             └──────────── bila perlu revisi: "Revisi N" di PLAN ←──────────────┘
```

## Alur per tugas
1. **PLAN** (Claude), dari `_TEMPLATE_PLAN.md`. Satu PLAN harus bisa diselesaikan agy **di bawah 15 menit** (batas SERVER_RULES). Tugas yang lebih besar dipecah menjadi beberapa PLAN berurutan.
2. **Implementasi** (agy) di branch `feat/...` yang disebut di PLAN. agy mematuhi `~/governance/rules/SERVER_RULES.md` dan matriks HITL. agy **tidak** melakukan commit, push, upgrade produksi, atau backup.
3. **LOG** (agy), dari `_TEMPLATE_LOG.md`, berisi ringkasan, file yang diubah, keputusan kecil, output tes **asli**, keraguan, dan pertanyaan.
4. **Review** (Claude): membaca LOG dan `git diff`, menjalankan tes sendiri, mengecek UI bila relevan, lalu menulis bagian **Review** di LOG: *Diterima* atau *Revisi* beserta alasannya.
5. **Revisi** (bila perlu): Claude menambah bagian `## Revisi N` di PLAN, lalu agy menjalankan ulang dan menambah bagian `## Putaran N` di LOG.
6. **Setelah diterima**, Claude melakukan commit (dengan atribusi AI), lalu merilis dengan `odoo/tools/release.sh <commit>` (backup → worktree produksi pindah ke commit → upgrade modul → restart).

## Manajemen risiko oleh agy
agy bertanggung jawab atas risiko pekerjaannya sendiri, bukan sekadar mengikuti instruksi. Setiap putaran memuat:

1. **Penilaian risiko sebelum mengubah kode.** Apa yang bisa rusak? Data produksi mana yang terdampak? Perlu migrasi? Ada dampak ke hak akses atau performa? **Wajib:** petakan semua pemakai field atau fungsi yang perilakunya berubah dengan `grep` (dashboard, dokumen deliverable, filter, tes), lalu cantumkan dampaknya di LOG.
2. **Perbaikan mandiri sesuai tingkat risiko:**

| Tingkat | Contoh | Boleh dikerjakan agy? |
| :-- | :-- | :-- |
| **R1 Rendah** | Perubahan di file "Boleh diubah" yang tercakup tes | Ya |
| **R2 Sedang** | Cacat di modul yang sama yang ditemukan saat bekerja (termasuk temuan review); menambah field baru tanpa mengubah data yang sudah ada | **Ya, mandiri.** Wajib ada tes yang membuktikan perbaikannya, dicatat di bagian *Perbaikan mandiri*, disertai analisis dampak ke data produksi |
| **R3 Tinggi** | Mengubah atau menghapus data yang sudah ada (migrasi data), mengganti nama atau menghapus kolom, mengubah security/ACL, perubahan lintas POC↔Odoo, keputusan desain/scope, infrastruktur | **Tidak.** Tulis sebagai *Temuan* beserta usulan PLAN, lalu lanjutkan sisa tugas |
| **Tier 3 HITL** | sudo, `rm -rf`, push, secret, Caddy/firewall, produksi | **Tidak pernah** |

3. **Self-review sebelum menulis LOG:** baca ulang `git diff` sendiri, jalankan tes, pastikan tidak ada file di luar scope tanpa alasan, pastikan `git -C ~/Projects/ea-desk-release status` tetap bersih, dan pastikan file baru tidak terabaikan git. Aturannya: file sistem wajib di git, sedangkan data transaksi dan hasil generate saat berjalan diabaikan (lihat `/.gitignore`). Produksi hanya menerima isi git; `release.sh` menolak rilis bila ada file modul yang terabaikan.

Dengan begitu, reviewer cukup memeriksa *penilaian risiko*, diff, tes, dan UI yang relevan. Review tetap jauh lebih hemat token dibanding implementasi.

## Lingkungan
| | Lokasi | Siapa yang mengubah |
| :-- | :-- | :-- |
| Working tree (pengembangan) | `~/Projects/ea-desk` | agy (implementasi), Claude (PLAN, commit) |
| **Produksi** (Odoo + POC) | `~/Projects/ea-desk-release`, git worktree *detached* pada commit yang sudah direview | Hanya `odoo/tools/release.sh` (Claude/pemilik) |
| Konfigurasi & password | `~/.config/ea-desk/odoo/` | Tidak ada yang membaca isinya |
| Tes Odoo | `odoo/docker-compose.dev.yml`, database `ea_test` | `odoo/tools/test.sh` |

## Yang tidak didelegasikan
- **Keputusan desain** (ADR, perubahan visi atau scope): dibahas dengan pemilik repo dulu.
- **Aksi Tier 3 HITL** (sudo, `rm -rf`, `git reset --hard`, push, membaca secret/`.env`, mengubah Caddy/firewall): dijalankan pemilik repo sendiri, juga bila agy yang membutuhkannya. agy cukup menuliskan kebutuhannya di LOG.
- **Produksi Odoo** (database `ea_desk`, `docker compose up/stop`, upgrade modul, backup): hanya Claude, setelah review lulus.

## Penamaan
`PLAN-001-adr-superseded-by.md` ↔ `LOG-001-adr-superseded-by.md`. Nomor naik terus dan tidak dipakai ulang.

## Verifikasi standar
| Bagian | Perintah |
| :-- | :-- |
| POC (Node) | `npm test` (dari root repo) |
| Modul Odoo | `sg docker -c "odoo/tools/test.sh"` (DB terpisah `ea_test`, bukan produksi) |
| UI | Diperiksa Claude dengan browser headless saat review |
