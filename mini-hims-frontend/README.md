# Mini HIMS — Frontend React (Vite)

Prototipe frontend Mini HIMS (AI Scribe), dibangun dengan React 18 & Vite, didasarkan pada PRD `TAG-Samurai/Mini-HIMS/PRD/ai-scribe/`.

## Cara Menjalankan

1. Masuk ke direktori:
   ```bash
   cd mini-hims-frontend
   ```

2. Instal dependensi:
   ```bash
   npm install
   # Atau pada Windows PowerShell jika ada pembatasan script policy:
   npm.cmd install
   ```

3. Jalankan server development:
   ```bash
   npm run dev
   # Atau:
   npm.cmd run dev
   ```

4. Buka browser di URL yang ditampilkan (default: `http://localhost:3000`).

Login demo:
- Username: `admin`
- Password: `demo`

## Build Production
```bash
npm run build
# Atau:
npm.cmd run build
```

## Struktur File
| Path | Deskripsi |
|------|-----------|
| `index.html` | HTML entry point Vite |
| `src/main.jsx` | Entry point React (ReactDOM.createRoot) |
| `src/App.jsx` | Komponen & logika UI utama |
| `src/data.js` | Mock data (in-memory, pengganti API) |
| `src/styles.css` | Styling CSS (light/dark mode) |
| `vite.config.js` | Konfigurasi bundler Vite |
| `README-handoff.md` | Handoff ke backend — model data & perilaku |
| `API-contract.md` | Kontrak API — endpoint yang perlu backend sediakan |

## Alur Utama
Patients (daftar/register) → Consultation (`+ New Recording` → pilih pasien terdaftar → Start Scribe → Finish → Review & Confirm → simpan/cetak resep) → History (full-sync, read-only).