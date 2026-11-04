# LOG-<NNN> — <judul singkat>

| PLAN | `PLAN-<NNN>-<slug>.md` | Implementer | agy (<model>) | Tanggal | YYYY-MM-DD |
| :-- | :-- | :-- | :-- | :-- | :-- |

## Putaran 1

### Penilaian risiko (sebelum mengubah kode)
| Risiko | Tingkat (R1/R2/R3) | Dampak ke data produksi | Mitigasi |
| :-- | :-- | :-- | :-- |

**Pemakai field/fungsi yang diubah (wajib, hasil `grep`):**
| Field / fungsi yang perilakunya berubah | Dipakai di (file:baris) | Dampak | Perlu disesuaikan? |
| :-- | :-- | :-- | :-- |

### Ringkasan yang dikerjakan
…

### File yang diubah
| File | Perubahan |
| :-- | :-- |

### Keputusan kecil & alasannya
- …

### Hasil tes (output asli, tidak diringkas)
```
<tempel output perintah tes persis seperti di terminal>
```

### Perbaikan mandiri (R2)
| Cacat yang ditemukan | Perbaikan | Tes yang membuktikan |
| :-- | :-- | :-- |

### Temuan yang tidak dikerjakan (R3) & usulan PLAN
- …

### Self-review
- [ ] `git diff` dibaca ulang; tidak ada file di luar scope tanpa alasan
- [ ] Tes lulus (output di atas)
- [ ] `git -C ~/Projects/ea-desk-release status` bersih; produksi tidak disentuh
- [ ] `git status --porcelain --ignored` tidak menunjukkan file sistem baru yang diabaikan (aturan di `/.gitignore`)

### Ragu / belum selesai
- …

### Pertanyaan untuk reviewer
- …

---

## Review (diisi Claude)
**Putusan:** Diterima / Revisi

**Yang diperiksa:** `git diff`, tes (`…`), UI (`…`)

**Catatan:**
- …
