package main

import (
	"fmt"
	"log"
	"medical/controller"
	"medical/db"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func patientRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		controller.HandleGetPatients(w, r)
	case http.MethodPost:
		controller.HandleCreatePatient(w, r)
	case http.MethodPut:
		controller.HandleUpdatePatient(w, r)
	case http.MethodDelete:
		controller.HandleDeletePatient(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func consultationRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		controller.HandleGetConsultations(w, r)
	case http.MethodPost:
		controller.HandleCreateConsultation(w, r)
	case http.MethodPut:
		controller.HandleUpdateConsultation(w, r)
	case http.MethodDelete:
		controller.HandleDeleteConsultation(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func main() {
	godotenv.Load()

	if _, err := db.InitDB(); err != nil {
		log.Fatalf("Gagal inisialisasi database: %v", err)
	}

	// 1. Pasien Endpoints (GET, POST, PUT, DELETE)
	http.HandleFunc("/api/patients", withCORS(patientRouter))

	// 2. Consultation Endpoints (GET, POST, PUT, DELETE)
	http.HandleFunc("/api/consultations", withCORS(consultationRouter))

	// 3. User & Quota Endpoints
	http.HandleFunc("/api/login", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			controller.HandleLogin(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/register", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			controller.HandleCreateUser(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/users", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			controller.HandleCreateUser(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/quota", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			controller.HandleGetQuota(w, r)
		} else {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	// 4. Speech to Text & Clinical Scribe
	http.HandleFunc("/api/transcribe", controller.NewSpeechController().HandleTranscribe)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Medical API Server berjalan di http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
