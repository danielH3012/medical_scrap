# Mini HIMS & AI Clinical Scribe

Sistem Informasi Manajemen Rumah Sakit & Klinik Mandiri (**Mini HIMS**) yang dilengkapi fitur **AI Clinical Scribe**. Sistem ini merekam percakapan dokter-pasien, melakukan transkripsi suara otomatis menggunakan Speech-to-Text (ElevenLabs), mengekstraksi format rekam medis standar **SOAP** *(Subjective, Objective, Assessment, Plan)* serta **Resep Obat** menggunakan LLM, dan mengelola rekam medis dengan isolasi multi-tenant di PostgreSQL.

---

## 🌟 Fitur Utama

- **Multi-Tenant Authentication & Data Isolation**:
  - Pendaftaran (*Sign Up*) dan Masuk (*Sign In*) berbasis akun database PostgreSQL.
  - Setiap dokter/pengguna memiliki ruang kerja terisolasi (`user_id`); data pasien dan riwayat konsultasi tidak bercampur antar akun.
- **Sistem Kuota AI Scribe**:
  - Kuota awal terisi otomatis (default **30 kuota** per pengguna baru).
  - Kuota berkurang 1 setiap kali dokter mereview dan memfinalisasi (*submit/synced*) hasil konsultasi ke rekam medis.
- **Manajemen Pasien (Master Data Pasien)**:
  - Pendaftaran pasien baru (Nama Lengkap, NIK 16 digit, Tanggal Lahir, Daftar Alergi).
  - Auto-generate Nomor Rekam Medis unik berformat `RM-YYYY-XXXX`.
  - Fitur pencarian cepat (berdasarkan Nama, NIK, atau no.RM) dan hapus data pasien.
- **AI Clinical Scribe & Perekaman Suara**:
  - Rekam audio interaksi dokter dan pasien langsung dari browser menggunakan Web Audio API.
  - Konversi otomatis rekaman ke format **WAV Linear PCM 16-bit 16kHz Mono** di sisi frontend untuk kompatibilitas penuh.
  - **Speech-to-Text (STT)**: Transkripsi audio percakapan klinis berbahasa Indonesia menggunakan ElevenLabs Scribe API.
  - **SOAP & Prescription Extraction**: Ekstraksi poin-poin medis penting (Subjective, Objective, Assessment, Plan, serta daftar obat, dosis, dan jumlah) berbasis kecerdasan buatan (OpenRouter / DeepSeek).
- **Review Draft & Cetak Resep Medis**:
  - Editor interaktif untuk dokter mengoreksi atau melengkapi SOAP dan resep obat sebelum disimpan permanen.
  - Tombol simpan draft dan sinkronisasi rekam medis.
  - Modul cetak resep obat (lembar cetak siap print atau PDF).
- **Desain Modern & Responsif**:
  - Antarmuka berbasis tema Gelap (*Dark Mode*) dan Terang (*Light Mode*).
  - Komponen visual premium dengan ikon Phosphor.

---

## 🛠️ Tech Stack & Arsitektur

### Frontend
- **Framework**: React 18, Vite
- **Styling**: Modern Vanilla CSS (Design Tokens, Glassmorphism, CSS Variables, Dark/Light theme)
- **Audio Processing**: Web Audio API & In-browser WAV Encoder (PCM 16-bit 16kHz mono)
- **Icons**: Phosphor Icons

### Backend
- **Bahasa**: Go (Golang 1.22+)
- **HTTP Server**: Native `net/http` dengan CORS middleware
- **ORM & Driver**: GORM dengan PostgreSQL driver (`github.com/lib/pq`)
- **AI Integration**:
  - **Speech-to-Text**: ElevenLabs Scribe API (`scribe_v2`)
  - **LLM Medical Extraction**: OpenRouter API (`deepseek/deepseek-v4-flash`)

### Database
- **DBMS**: PostgreSQL 15+

---

## 📁 Struktur Direktori

```text
medical_scrap/
├── README.md                      # Dokumentasi teknis proyek
├── db.sql                         # Skema dan dump database PostgreSQL
├── medical/                       # Backend service (Golang)
│   ├── controller/                # Handler & logika bisnis
│   │   ├── create_consultation.go # Pembuatan sesi konsultasi
│   │   ├── create_pasien.go       # Pendaftaran pasien baru
│   │   ├── create_user.go         # Registrasi user dokter baru
│   │   ├── delete_consultation.go # Penghapusan data konsultasi
│   │   ├── delete_pasien.go       # Penghapusan data pasien
│   │   ├── get_consultation.go    # Query daftar/detail konsultasi
│   │   ├── get_pasien.go          # Query daftar/detail pasien
│   │   ├── get_quota.go           # Pengecekan sisa kuota user
│   │   ├── login_user.go          # Autentikasi user
│   │   ├── tenant.go              # Helper ekstraksi multi-tenant X-User-Id
│   │   ├── transcribe.go          # Integrasi STT & ekstraksi LLM SOAP
│   │   ├── update_consultation.go # Update SOAP, resep, dan status konsultasi
│   │   └── update_pasien.go       # Pembaruan informasi pasien
│   ├── db/
│   │   └── database.go            # Inisialisasi koneksi GORM PostgreSQL
│   ├── model/
│   │   └── models.go              # Definisi model GORM (User, Pasien, Consultation)
│   ├── .env                       # Konfigurasi database dan API key AI
│   ├── go.mod                     # Go modules dependency
│   └── main.go                    # Entry point backend server
└── mini-hims-frontend/            # Frontend application (React + Vite)
    ├── src/
    │   ├── api.js                 # API client wrapper & tenant header injector
    │   ├── App.jsx                # Komponen utama UI, state manager & views
    │   └── main.jsx               # React DOM bootstrap
    ├── index.html                 # HTML shell
    ├── package.json               # Dependensi frontend
    └── vite.config.js             # Konfigurasi Vite & proxy dev server
```

---

## 🗄️ Skema Database (PostgreSQL)

Database bernama `medical` terdiri dari 3 tabel utama:

### 1. Tabel `public."user"`
Menyimpan kredensial akun dokter/praktisi dan kuota AI Scribe.
```sql
CREATE TABLE public."user" (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nama character varying(125),
    password character varying(125),
    quota bigint DEFAULT 30
);
```

### 2. Tabel `public.pasien`
Menyimpan data master rekam medis pasien terisolasi per dokter (`user_id`).
```sql
CREATE TABLE public.pasien (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "noRM" character varying(125),
    name character varying(255),
    nik character varying(125),
    dob character varying(125),
    allergies character varying(125)[],
    user_id bigint
);
```

### 3. Tabel `public.consultations`
Menyimpan riwayat pemeriksaan, draft rekaman, SOAP, dan resep obat.
```sql
CREATE TABLE public.consultations (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "patientId" bigint,
    status character varying(125),      -- 'In Progress', 'Draft Ready', 'Synced'
    "startedAt" character varying(125),
    soap text[],                        -- Array [Subjective, Objective, Assessment, Plan]
    prescription text[],                -- Array JSON string resep obat
    user_id bigint
);
```

---

## 🔌 Dokumentasi REST API

Semua request yang membutuhkan autentikasi tenant menyertakan header:
`X-User-Id: <user_id>`

### 1. Autentikasi & User
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/register` | Mendaftarkan akun dokter baru (otomatis set kuota 30) |
| `POST` | `/api/login` | Masuk ke sistem dengan username & password |
| `GET` | `/api/quota` | Mendapatkan informasi sisa kuota akun aktif |

### 2. Pasien (`/api/patients`)
| Method | Endpoint | Header | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/patients` | `X-User-Id` | Mengambil semua pasien milik akun (support filter `?q=...` dan `?id=...`) |
| `POST` | `/api/patients` | `X-User-Id` | Mendaftarkan pasien baru (auto generate `noRM`) |
| `PUT` | `/api/patients` | `X-User-Id` | Memperbarui data pasien |
| `DELETE` | `/api/patients?id={id}` | `X-User-Id` | Menghapus data pasien beserta konsultasinya |

### 3. Konsultasi (`/api/consultations`)
| Method | Endpoint | Header | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/consultations` | `X-User-Id` | Mengambil data konsultasi (support `?status=active` atau `?status=synced`) |
| `POST` | `/api/consultations` | `X-User-Id` | Membuat sesi konsultasi baru (`status: 'In Progress'`) |
| `PUT` | `/api/consultations` | `X-User-Id` | Mengupdate SOAP, resep, atau finalisasi status (`Synced` -> kuota berkurang 1) |
| `DELETE` | `/api/consultations?id={id}` | `X-User-Id` | Menghapus konsultasi |

### 4. AI Scribe & Speech-to-Text
| Method | Endpoint | Content-Type | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/transcribe` | `multipart/form-data` | Menerima file audio `audio_file` (WAV/WebM), memproses STT via ElevenLabs, dan ekstraksi SOAP via LLM OpenRouter |

---

## 🚀 Panduan Menjalankan Sistem

### 1. Prasyarat
- **Go**: v1.22 atau lebih baru
- **Node.js**: v18 atau lebih baru
- **PostgreSQL**: v14 atau lebih baru yang aktif di `localhost:5432`

### 2. Setup Database
Pastikan service PostgreSQL berjalan, buat database `medical`, lalu impor file `db.sql`:
```bash
# Melalui terminal PostgreSQL (psql)
psql -U postgres -c "CREATE DATABASE medical;"
psql -U postgres -d medical -f db.sql
```

### 3. Setup & Menjalankan Backend (Go)
1. Buka direktori backend:
   ```bash
   cd medical
   ```
2. Pastikan file `.env` sudah sesuai:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_NAME=medical
   DB_SSLMODE=disable

   STT_API_KEY=your_elevenlabs_api_key
   STT_URL=https://api.elevenlabs.io/v1/speech-to-text
   STT_MODEL=scribe_v2
   STT_LANGUAGE=id

   AI_KEY=your_openrouter_api_key
   BASE_AI_URL=https://openrouter.ai/api/v1
   AI_MODEL=deepseek/deepseek-v4-flash-0731:free
   ```
3. Unduh dependensi dan jalankan server:
   ```bash
   go mod tidy
   go run main.go
   ```
   *Server backend akan berjalan di `http://localhost:8080`.*

### 4. Setup & Menjalankan Frontend (React + Vite)
1. Buka terminal baru dan masuk ke direktori frontend:
   ```bash
   cd mini-hims-frontend
   ```
2. Instal paket dependensi:
   ```bash
   npm install
   ```
3. Jalankan development server:
   ```bash
   npm run dev
   ```
   *Aplikasi frontend akan dapat diakses di `http://localhost:3000` (atau port yang diberikan oleh Vite).*

---

## 🩺 Alur Kerja Penggunaan (Clinical Workflow)

1. **Login / Sign Up**:
   - Dokter membuat akun baru atau login menggunakan akun yang ada (tersedia akun default `admin` / `password`).
2. **Kelola Pasien**:
   - Masuk ke tab **Patients** untuk mendaftarkan pasien baru atau mencari riwayat pasien.
3. **Mulai Sesi Konsultasi**:
   - Di tab **Consultation**, klik **`+ New Recording`**.
   - Pilih pasien dari daftar (*Patient Picker*).
4. **Perekaman & Transkripsi Suara**:
   - Izinkan mikrofon browser.
   - Tekan **Start Recording** saat pemeriksaan dimulai.
   - Setelah selesai, tekan **Stop & Generate Notes**. Browser akan mengonversi audio ke WAV 16kHz dan mengirimnya ke backend.
   - Sistem mentranskripsikan audio dan secara otomatis memetakan percakapan ke format SOAP & saran obat.
5. **Review & Finalisasi**:
   - Dokter memeriksa catatan medis di layar **Review Draft**.
   - Tambah atau edit SOAP dan obat jika diperlukan.
   - Klik **Approve & Save** untuk menyimpan ke rekam medis permanen (kuota dokter akan berkurang 1).
6. **Cetak Resep**:
   - Jika terdapat resep obat, dialog cetak resep medis otomatis terbuka dan siap dicetak/diserahkan ke bagian farmasi.
