# ADR-004 — Standar Struktur Deliverable EA dan katalog produk sebagai spesifikasi deliverable

- **Status:** Accepted (2026-10-29)

## Context
Setiap deliverable EA adalah hasil sebuah layanan EA (produk). Dokumen perlu menjelaskan dirinya sendiri (apa, untuk keputusan apa, untuk siapa, dengan klasifikasi apa) dengan standar yang sama, dan tetap konsisten dengan data sumbernya. Contoh rancangannya ada di `docs/contoh/Contoh_Deliverable_Rekomendasi_Domain_Data.md`.

## Decision
1. **Katalog Produk EA berfungsi sebagai spesifikasi deliverable.** Field yang dipakai: layanan TOGAF, kode output SOP, klasifikasi, skema kode dokumen, template utama, **konten baku**, dan langkah yang dibedakan antara *metode* dan *tata kelola*, beserta penanda "jadi bab dokumen".
2. **Satu Standar Struktur Deliverable global** (template `standar-deliverable`). Bagian dokumen dibagi menjadi empat jenis:
   - 🟦 **Dinamis struktural:** Lembar Kendali, Riwayat Versi, Tujuan, Ruang Lingkup, Keputusan, Isu Terbuka, Pemeliharaan.
   - 🟩 **Dinamis produk:** Metode, judul bab isi, dan konten baku.
   - ✍️ **Manual.**
   - 🟨 **Campuran.**
3. **Reference data baru:**
   - **Klasifikasi Informasi:** ditetapkan per produk, bisa di-override per engagement.
   - **Skema Kode Dokumen:** pola bertoken. Kode ditetapkan sekali saat dokumen pertama dibuat; versi dicatat terpisah.
4. **Isu & Asumsi** menjadi entitas sendiri (ISU-NNN). Isu yang opsinya sudah jelas dapat dijadikan ADR.
5. **Validasi sumber sebelum dokumen dibuat:**
   - **Memblokir:** engagement tanpa produk, layanan TOGAF kosong, tidak ada klasifikasi, tidak ada skema kode.
   - **Peringatan:** bukti persetujuan gerbang lemah, lokasi dokumen bukan tautan, langkah yang seharusnya menghasilkan ADR tetapi belum ada, mode berbeda dari mode bawaan produk.

## Consequences
- (+) Mengubah standar cukup di satu tempat. Produk yang naik versi otomatis mengubah kerangka dokumen berikutnya.
- (−) Produk harus dirawat lebih lengkap. Pola kode dokumen awal (`DLV/{sop}/{engagement}`) masih usulan dan perlu diselaraskan dengan Document Control WIKA.
