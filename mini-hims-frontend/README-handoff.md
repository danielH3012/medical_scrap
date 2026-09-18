# Mini HIMS — Frontend Prototype (Handoff untuk Backend)

## Tentang
Prototype frontend Mini HIMS (AI Scribe) — mengikuti PRD `TAG-Samurai/Mini-HIMS/PRD/ai-scribe/`.
Saat ini memakai **mock data di memori** (`data.js`) sebagai pengganti API. Backend perlu menggantikan mock ini dengan API sungguhan.

## Cara Menjalankan
Tanpa build tool (React + Babel standalone, di-browser):
```bash
cd mini-hims-frontend
python3 -m http.server 8090
# lalu buka http://localhost:8090
```

Login demo: username `admin` / password `demo` (master account, semua role).

## Struktur File
| File | Isi |
|------|-----|
| `index.html` | Entry HTML (load React/Babel/Phosphor/Inter) |
| `app.jsx` | Seluruh komponen & logika UI (React) |
| `data.js` | **Mock data** — pengganti API yang harus direplace oleh backend |
| `styles.css` | Styling (light/dark theme dgn CSS variables) |

## Model Data (dari `data.js` — yang Backend harus sediakan)
> Struktur ini apa yang frontend konsumsi. Backend menyediakan endpoint yang mengembalikan bentuk serupa.

### User / Auth
```js
{ id, username, name, role }        // role: 'Dokter' | 'Admin Klinik' (prototype: master)
```

### Patient
```js
{
  id, noRM,              // noRM = identitas utama (auto-generate)
  name,
  nik,                   // OPSIONAL (bayi/balita boleh kosong)
  dob,                   // yyyy-mm-dd
  allergies: []          // array string
}
```

### Consultation / Sesi Scribe
```js
{
  id,
  patientId,
  status: 'In Progress' | 'Draft Ready' | 'Sync Failed',
  startedAt,             // "yyyy-mm-dd HH:mm"
  soap: { subjective, objective, assessment, plan },
  prescription: [ { drug, dosage, qty } ]   // kosong jika tanpa resep
}
```

### History (kunjungan full-sync)
```js
{
  id,
  patientId,
  date,                  // "yyyy-mm-dd"
  soap: { ... },
  prescription: [ ... ]
}
```

### Quota
```js
{ used, total }          // kuota scribe per-klinik (pooled)
```

## Perilaku Frontend (yang harus didukung backend)
- **Login** single master (prototype). Produksi: 2 role (Dokter / Admin Klinik).
- **Register pasien**: terpisah (halaman Patients) — Nama wajib, NIK opsional, DoB wajib, no.RM auto.
- **New Recording**: modal pilih pasien yang SUDAH terdaftar (tanpa register di dalamnya).
- **Sesi Scribe**: Start Scribe (konsen) → listening → Finish → composing → draft SOAP.
- **Review & Confirm**: draft SOAP + resep (kondisional), wajib konfirmasi sebelum final.
- **Cetak resep**: tanda tangan **fisik** (bukan TTE) — reminder ditampilkan.
- **Sync SATUSEHAT**: background, non-blocking; sukses → pindah ke History; gagal → tetap di Consultation (Sync Failed).
- **Riwayat**: read-only + Detail view.
- **no.RM** = identitas utama; **NIK opsional**; pasien tanpa NIK skip MPI.

## Catatan Penting untuk Backend
- Mock saat ini **in-memory** (hilang saat refresh). Backend menyediakan persistence.
- Validasi utama: Nama wajib, NIK (ops, jika ada = 16 digit numerik), DoB wajib, no.RM unik.
- Status consultation mengikuti PRD: In Progress / Draft Ready / Sync Failed.
- Referensi status/transisi lengkap: `TAG-Samurai/Mini-HIMS/PRD/ai-scribe/03-functional.md`.