package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strings"
	"time"
)

type CreateConsultationRequest struct {
	PatientID    uint                    `json:"patientId"`
	Status       string                  `json:"status"`
	StartedAt    string                  `json:"startedAt"`
	SOAP         model.SOAPDTO           `json:"soap"`
	Prescription []model.PrescriptionDTO `json:"prescription"`
}

func HandleCreateConsultation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	var req CreateConsultationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Format data JSON tidak valid: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.PatientID == 0 {
		http.Error(w, `{"error":"patientId wajib diisi"}`, http.StatusBadRequest)
		return
	}

	// Pastikan pasien milik akun/tenant yang sedang login
	var pat model.Pasien
	if err := db.DB.Where("id = ? AND user_id = ?", req.PatientID, tenantID).First(&pat).Error; err != nil {
		http.Error(w, `{"error":"Pasien tidak ditemukan atau bukan milik akun Anda"}`, http.StatusBadRequest)
		return
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "In Progress"
	}

	startedAt := strings.TrimSpace(req.StartedAt)
	if startedAt == "" {
		startedAt = time.Now().Format("2006-01-02 15:04")
	}

	consult := model.Consultation{
		PatientID: req.PatientID,
		Status:    status,
		StartedAt: startedAt,
		UserID:    tenantID,
	}
	consult.SetSOAP(req.SOAP)
	consult.SetPrescription(req.Prescription)

	if err := db.DB.Create(&consult).Error; err != nil {
		http.Error(w, `{"error":"Gagal membuat sesi konsultasi: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(consult.ToResponse())
}
