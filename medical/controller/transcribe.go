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
	"strconv"

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

type PrescriptionItem struct {
	Drug   string `json:"drug"`
	Dosage string `json:"dosage"`
	Qty    any    `json:"qty"`
}

type SOAPDraft struct {
	Subjective string `json:"subjective"`
	Objective  string `json:"objective"`
	Assessment string `json:"assessment"`
	Plan       string `json:"plan"`
}

type FullDraft struct {
	Subjective   string             `json:"subjective"`
	Objective    string             `json:"objective"`
	Assessment   string             `json:"assessment"`
	Plan         string             `json:"plan"`
	Prescription []PrescriptionItem `json:"prescription"`
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

	respPrompt :=
		`Anda adalah asisten pencatatan medis (clinical scribe) profesional.
	Tugas Anda: Analisis transkrip konsultasi dokter-pasien, lalu rangkum menjadi catatan rekam medis SOAP (Subjective, Objective, Assessment, Plan) serta ekstrak LANGSUNG dari percakapan seluruh daftar resep obat (prescription) yang diberikan dokter.

	Definisi dan aturan per kategori:
	1. "subjective": Rangkum keluhan utama, riwayat penyakit sekarang, durasi/onset gejala, riwayat alergi, atau riwayat pengobatan yang disampaikan pasien atau keluarganya.
	2. "objective": Rangkum temuan pemeriksaan fisik, tanda-tanda vital, dan observasi langsung oleh dokter saat pemeriksaan.
	3. "assessment": Tuliskan diagnosis klinis dokter.
	4. "plan": Rangkum rencana tindakan non-obat, edukasi hidrasi/istirahat, dan anjuran kontrol kembali.
	5. "prescription": Ekstrak LANGSUNG dari ucapan dokter seluruh obat yang diresepkan/diberikan kepada pasien:
	   - Sertakan obat yang disebut namanya secara spesifik (misal: "Azitromisin 500mg").
	   - Sertakan juga obat yang disebutkan fungsinya oleh dokter (misal: jika dokter menyebut "obat pereda demam dan nyeri" -> ekstrak Paracetamol / obat pereda demam dan nyeri, jika dokter menyebut "dekongestan" -> ekstrak Dekongestan).
	   - "dosage": cara konsumsi atau frekuensi yang diinstruksikan dokter (contoh: "1x sehari selama 3 hari", "3x sehari", atau "-" jika tidak dirinci).
	   - "qty": jumlah obat yang diberikan (contoh: 3, 10, atau "-" jika tidak dirinci).
	   - Jika dokter tidak memberikan resep obat sama sekali, berikan array kosong [].

	Format Output:
	Keluarkan HANYA satu objek JSON valid, tanpa teks penjelasan tambahan, tanpa markdown code fence, dengan skema persis:
	{
		"subjective": "...",
		"objective": "...",
		"assessment": "...",
		"plan": "...",
		"prescription": [
			{
				"drug": "...",
				"dosage": "...",
				"qty": 10
			}
		]
	}`
	query := "Ekstrak catatan medis SOAP dan daftar resep (prescription) langsung dari percakapan dokter-pasien berikut."
	respJSON, err := goaipackage.GenerateResponse(r.Context(), query, finalText, nil, os.Getenv("AI_MODEL"), goaipackage.WithResponsePrompt(respPrompt))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	fullDraft := cleanAndExtractDraft(respJSON)
	if fullDraft.Subjective == "" && fullDraft.Objective == "" && fullDraft.Assessment == "" && fullDraft.Plan == "" && len(fullDraft.Prescription) == 0 {
		log.Printf("[/api/transcribe AI Warning] Hasil ekstraksi SOAP kosong, raw: %s", respJSON)
	}

	soapOnly := SOAPDraft{
		Subjective: fullDraft.Subjective,
		Objective:  fullDraft.Objective,
		Assessment: fullDraft.Assessment,
		Plan:       fullDraft.Plan,
	}

	respData := map[string]any{
		"soap":         soapOnly,
		"prescription": fullDraft.Prescription,
	}

	respBytes, err := json.MarshalIndent(respData, "", "  ")
	if err != nil {
		http.Error(w, "Gagal meng-encode response JSON: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(respBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(respBytes)
}

func cleanAndExtractDraft(raw string) *FullDraft {
	current := strings.TrimSpace(raw)

	for iter := 0; iter < 5; iter++ {
		current = strings.TrimSpace(current)

		// Strip markdown code fence: ```json ... ```
		if strings.HasPrefix(current, "```") {
			lines := strings.Split(current, "\n")
			if len(lines) >= 2 {
				lines = lines[1:]
				if len(lines) > 0 && strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), "```") {
					lines = lines[:len(lines)-1]
				}
				current = strings.TrimSpace(strings.Join(lines, "\n"))
			}
		}

		// Find outermost { and }
		startIdx := strings.Index(current, "{")
		endIdx := strings.LastIndex(current, "}")
		if startIdx != -1 && endIdx != -1 && endIdx > startIdx {
			current = current[startIdx : endIdx+1]
		}

		// Try direct unmarshal
		var draft FullDraft
		if err := json.Unmarshal([]byte(current), &draft); err == nil {
			if draft.Subjective != "" || draft.Objective != "" || draft.Assessment != "" || draft.Plan != "" || len(draft.Prescription) > 0 {
				if draft.Prescription == nil {
					draft.Prescription = []PrescriptionItem{}
				}
				return &draft
			}
		}

		// Try unmarshaling into generic map to check wrappers like {"answer": ...} or {"soap": ...}
		var genericMap map[string]any
		if err := json.Unmarshal([]byte(current), &genericMap); err == nil && len(genericMap) > 0 {
			unwrapped := false
			for _, key := range []string{"answer", "soap", "data"} {
				if val, exists := genericMap[key]; exists {
					if strVal, ok := val.(string); ok {
						current = strings.TrimSpace(strVal)
						unwrapped = true
						break
					}
					if subMap, ok := val.(map[string]any); ok {
						subBytes, _ := json.Marshal(subMap)
						var subDraft FullDraft
						if errSub := json.Unmarshal(subBytes, &subDraft); errSub == nil {
							if subDraft.Subjective != "" || subDraft.Objective != "" || subDraft.Assessment != "" || subDraft.Plan != "" || len(subDraft.Prescription) > 0 {
								if subDraft.Prescription == nil {
									subDraft.Prescription = []PrescriptionItem{}
								}
								return &subDraft
							}
						}
					}
				}
			}
			if unwrapped {
				continue
			}
		}

		break
	}

	var fallback FullDraft
	_ = json.Unmarshal([]byte(current), &fallback)
	if fallback.Prescription == nil {
		fallback.Prescription = []PrescriptionItem{}
	}
	return &fallback
}
