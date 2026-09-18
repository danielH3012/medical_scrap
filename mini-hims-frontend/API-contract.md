# Mini HIMS — API Contract (Draft untuk Backend)

> Draft endpoint yang dibutuhkan frontend prototipe, diturunkan dari alur UI (`app.jsx`) & mock (`data.js`).
> Backend bebas menyesuaikan (path/HTTP) asal mengembalikan bentuk data yang sama.
> Auth: perlu mekanisme sesi/token (produksi: 2 role — Dokter & Admin Klinik).

## Konvensi
- Base: `/api`
- Semua respons `application/json`
- Bentuk data mengikuti skema di `README-handoff.md`

---

## Auth
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/auth/login` | Body `{ username, password }` → `{ user, token }`. Prototype terima `admin`/`demo` |
| POST | `/api/auth/logout` | Hapus sesi |

---

## Patients (halaman Patients; register terpisah di awal)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/patients?q=` | List pasien (search no.RM / NIK / nama, case-insensitive) |
| POST | `/api/patients` | Register pasien baru → body `{ name, nik?, dob }` → `{ id, noRM, ... }`. **no.RM auto-generate**, NIK opsional |
| GET | `/api/patients/:id` | Detail pasien |

---

## Quota
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/quota` | → `{ used, total }` (kuota scribe per-klinik) |

---

## Consultations (sesi scribe aktif)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/consultations` | List sesi aktif (status In Progress / Draft Ready / Sync Failed) |
| GET | `/api/consultations/:id` | Detail sesi |
| POST | `/api/consultations` | Mulai sesi baru → body `{ patientId }` → `{ id, status: 'In Progress', ... }` (**decrement quota**) |
| POST | `/api/consultations/:id/transcribe` | Body dari AI STT → susun draft SOAP (meniru alur Scribe) |
| PUT | `/api/consultations/:id` | Simpan final setelah Review & Confirm → body `{ soap, prescription }` → status `Draft Ready` |
| POST | `/api/consultations/:id/resolve` | Tandai? (opsional) |

> Alur Scribe (Start → Finish → composing): frontend menunggu hasil transkripsi (simulasi di `app.jsx`). Backend menyediakan transcribe/SOAP-generation atau frontend tetap pakai mock untuk itu sementara.

---

## Sync SATUSEHAT (background, non-blocking)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/consultations/:id/sync` | Trigger sync; sukses → pindah ke history; gagal → status `Sync Failed` |
| GET | `/api/consultations/:id/sync-status` | Status sync saat ini |

---

## History (kunjungan full-sync, read-only)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/history?q=` | List kunjungan full-sync (search nama/NIK) |
| GET | `/api/history/:id` | Detail kunjungan (SOAP + resep) — view-only |

---

## Cetak Resep (tanda tangan fisik)
- Frontend pakai dialog `window.print()` pada resep yang sudah disimpan (bukan API khusus).
- Backend cukup menyediakan resep pada detail consultation/history.

---

## Validasi (kunci)
| Field | Rule |
|-------|------|
| name | wajib |
| nik | opsional; jika diisi = 16 digit numerik |
| dob | wajib |
| noRM | unik, auto-generate |
| consultation.status | In Progress / Draft Ready / Sync Failed |
| quota | decrement saat mulai sesi baru (per-klinik, pooled) |

Referensi lengkap perilaku & transisi: `TAG-Samurai/Mini-HIMS/PRD/ai-scribe/03-functional.md`.