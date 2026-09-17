package controller

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	textandspeech "github.com/danielH3012/text-and-speech"
	"github.com/joho/godotenv"

	"encoding/json"
	"log"

	goaipackage "github.com/danielH3012/go_ai_package"
	"github.com/google/uuid"
)

type SpeechController struct{}

func NewSpeechController() *SpeechController {
	return &SpeechController{}
}

func (c *SpeechController) getSTTConfig() textandspeech.STTConfig {
	return textandspeech.STTConfig{
		API_KEY:            os.Getenv("STT_API_KEY"),
		STT_URL:            os.Getenv("STT_URL"),
		STT_MODEL:          os.Getenv("STT_MODEL"),
		STT_FILE_FIELD:     os.Getenv("STT_FILE_FIELD"),
		STT_MODEL_FIELD:    os.Getenv("STT_MODEL_FIELD"),
		STT_LANGUAGE_FIELD: os.Getenv("STT_LANGUAGE_FIELD"),
		STT_HEADER:         os.Getenv("STT_HEADER"),
		STT_AUTH_PREFIX:    os.Getenv("STT_AUTH_PREFIX"),
		STT_LANGUAGE:       textandspeech.NormalizeSTTLanguage(os.Getenv("STT_LANGUAGE")),
	}
}

func (c *SpeechController) HandleTranscribe(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	godotenv.Load()
	if r.Method == http.MethodOptions {
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Gagal membaca form multipart: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("audio")
	if err != nil || file == nil {
		file, header, err = r.FormFile("file")
	}
	if err != nil || file == nil {
		http.Error(w, "File audio tidak ditemukan ('audio' atau 'file' field diperlukan)", http.StatusBadRequest)
		return
	}
	defer file.Close()

	_ = os.MkdirAll("./tmp", 0755)
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".wav"
	}
	tempAudioPath := filepath.Join("./tmp", fmt.Sprintf("stt_%s%s", uuid.New().String(), ext))
	dst, err := os.Create(tempAudioPath)
	if err != nil {
		http.Error(w, "Gagal membuat file sementara: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		_ = os.Remove(tempAudioPath)
		http.Error(w, "Gagal menulis file audio: "+err.Error(), http.StatusInternalServerError)
		return
	}
	dst.Close()
	defer os.Remove(tempAudioPath)

	cfg := c.getSTTConfig()
	if reqKey := strings.TrimSpace(r.FormValue("api_key")); reqKey != "" && cfg.API_KEY == "" {
		cfg.API_KEY = reqKey
	}
	if reqURL := strings.TrimSpace(r.FormValue("stt_url")); reqURL != "" {
		cfg.STT_URL = reqURL
	}
	if reqModel := strings.TrimSpace(r.FormValue("model")); reqModel != "" {
		cfg.STT_MODEL = reqModel
	}
	if reqLang := strings.TrimSpace(r.FormValue("language")); reqLang != "" {
		cfg.STT_LANGUAGE = textandspeech.NormalizeSTTLanguage(reqLang)
	}

	log.Printf("[/api/transcribe] Processing STT — file: %s, size: %d bytes, model: %s, lang: %s", header.Filename, header.Size, cfg.STT_MODEL, cfg.STT_LANGUAGE)
	transcription, err := textandspeech.Transcribe(cfg, tempAudioPath)
	if err != nil {
		log.Printf("[/api/transcribe Error] %v", err)
		http.Error(w, fmt.Sprintf("Gagal transkripsi audio: %v", err), http.StatusInternalServerError)
		return
	}

	// textandspeech.Transcribe already cleans and parses text, but ensure no JSON wrapper is left
	var parsedSTT struct {
		Text string `json:"text"`
	}
	finalText := transcription
	if err := json.Unmarshal([]byte(transcription), &parsedSTT); err == nil && parsedSTT.Text != "" {
		finalText = parsedSTT.Text
	}

	fmt.Printf("Final Transcription: %s\n", strings.TrimSpace(finalText))

	goaipackage.SetAIConfig(os.Getenv("AI_KEY"), os.Getenv("BASE_AI_URL"))

	respPrompt := fmt.Sprintf(
		`Anda adalah asisten pencatatan medis. Tugas Anda: baca transkrip konsultasi dokter-pasien, pecah menjadi kalimat/klausa berurutan sesuai kemunculannya di transkrip, lalu beri label SOAP pada setiap kalimat.
		Definisi label:
			- "S" (subjective): keluhan, gejala, atau riwayat yang disampaikan PASIEN dengan kata-katanya sendiri, termasuk saat dikutip ulang oleh dokter (mis. "pasien mengatakan...").
  			  Contoh: "Saya merasa nyeri di dada sejak kemarin malam."
			- "O" (objective): temuan yang diukur/diamati langsung oleh tenaga medis — tanda vital, hasil pemeriksaan fisik, hasil lab/pencitraan.
  			  Contoh: "Tekanan darah 140/90 mmHg, suhu 37.8°C."
			- "A" (assessment): interpretasi klinis atau diagnosis yang disimpulkan dokter dari data subjective dan objective.
  			  Contoh: "Kemungkinan besar gastritis akut."
			- "P" (plan): tindakan, terapi, obat, dosis, rujukan, atau instruksi tindak lanjut.
  			  Contoh: "Berikan omeprazole 20mg 2x sehari selama 5 hari."
			- "N" (none): basa-basi, salam, atau kalimat tanpa informasi medis relevan.

		Aturan:
		1. JANGAN mengelompokkan ulang kalimat berdasarkan kategori. Pertahankan urutan kemunculan PERSIS seperti di transkrip asli — urutan label akhir boleh acak (mis. S,O,S,A,O,P), tidak harus S,O,A,P berurutan.
		2. Kutip kalimat APA ADANYA (verbatim) — jangan meringkas, menerjemahkan, atau menulis ulang.
		3. Setiap kalimat mendapat TEPAT SATU label. Jika satu kalimat memuat lebih dari satu jenis informasi, pilih yang paling dominan.
		4. Jika ada label pembicara (mis. "Dokter:", "Pasien:") di transkrip, gunakan sebagai petunjuk tambahan saja — isi kalimat yang menentukan label, bukan siapa yang bicara.
		5. Keluarkan HANYA satu objek JSON valid, tanpa teks tambahan, tanpa markdown code fence, dengan skema persis:
		{
  		  "answer": [
    		{"text": "<kalimat asli>", "label": "S"},
    		{"text": "<kalimat asli>", "label": "O"}
  		  ]
		}
		6. Jika transkrip sama sekali tidak memuat kalimat relevan SOAP, kembalikan "answer": [] (array kosong).
		
		Aturan disambiguasi S vs O:
		1. Pertanyaan dokter yang MENGGALI riwayat/gejala/keluhan pasien (anamnesis) → label S, walaupun yang bicara adalah dokter. Contoh: "Ada demam?", "Riwayat alergi obat?", "Sedang minum obat rutin lain?"

		2. Data vital/fisik hanya berlabel O jika DIUKUR LANGSUNG oleh  dokter saat konsultasi berlangsung (TTV, inspeksi, auskultasi, perkusi, palpasi). Jika angka yang sama dilaporkan pasien dari pengukuran sebelumnya (di rumah, kemarin, dsb) → tetap S. Contoh: "Suhu saya 38.5 kemarin malam" (pasien lapor) = S "Suhu 38.1 derajat" (dokter ukur saat ini) = O

		3. Kalimat transisi/basa-basi dokter tanpa muatan klinis (sapaan, "saya periksa dulu ya", "silakan duduk") → N.`)
	query := fmt.Sprint("bagi perkalimat, apakah itu subjective, objective, assessment, atau plan (SOAP) atau bukan, dari transkrip yang diberikan")
	respJSON, err := goaipackage.GenerateResponse(r.Context(), query, finalText, nil, os.Getenv("AI_MODEL"), goaipackage.WithResponsePrompt(respPrompt))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var parsed struct {
		Answer string `json:"answer"`
	}
	if err := json.Unmarshal([]byte(respJSON), &parsed); err != nil || parsed.Answer == "" {
		parsed.Answer = respJSON
	}

	respData := map[string]any{
		"answer": parsed.Answer,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(respData)
}
