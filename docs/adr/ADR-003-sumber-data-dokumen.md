# ADR-003 — Data tata kelola bersumber dari EA Desk; dokumen menyimpan analisis

- **Status:** Accepted (2026-10-29)

## Context
Template dokumen menyebabkan data yang sudah ada di EA Desk (identitas engagement, sponsor, scope, daftar ADR, artefak) diketik ulang di Word/Docs. Akibatnya ada dua sumber kebenaran yang lama-kelamaan saling menyimpang.

## Alternatives
- **A. Template + placeholder:** data diisi otomatis saat dokumen dibuat.
- **B. Dokumen hidup di EA Desk:** seluruh bab disimpan sebagai field, lalu Word/PDF di-generate. Kolaborasi Word/Docs hilang, dan EA Desk berubah menjadi alat penulisan dokumen.
- **C. Hibrida:** A + snapshot otomatis saat gerbang dilewati.

## Decision
**C.** Isi dokumen dibedakan berdasarkan sifatnya:
- **Data tata kelola** selalu diambil dari EA Desk dan tidak pernah diketik ulang.
- **Isi analisis** ditulis di Word/Docs.

Bagian otomatis diberi stempel sumber dan waktu. Setiap kali gerbang dilewati, EA Desk menyimpan snapshot dokumen sebagai lampiran artefak.

## Consequences
- (+) Satu sumber kebenaran. Snapshot menjadi bukti apa yang disetujui di setiap gerbang.
- (−) Dokumen Word tidak sinkron secara langsung. Bagian otomatis harus diperbarui ulang dari EA Desk bila datanya berubah.
