package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strconv"
	"strings"

	"github.com/lib/pq"
)

type UpdatePatientRequest struct {
	ID        uint     `json:"id"`
	NoRM      string   `json:"noRM"`
	Name      string   `json:"name"`
	NIK       string   `json:"nik"`
	DOB       string   `json:"dob"`
	Allergies []string `json:"allergies"`
}

func HandleUpdatePatient(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	var req UpdatePatientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Format data JSON tidak valid: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.ID == 0 {
		idStr := r.URL.Query().Get("id")
		if id, err := strconv.Atoi(idStr); err == nil {
			req.ID = uint(id)
		}
	}

	if req.ID == 0 {
		http.Error(w, `{"error":"ID pasien diperlukan"}`, http.StatusBadRequest)
		return
	}

	var patient model.Pasien
	if err := db.DB.Where("id = ? AND user_id = ?", req.ID, tenantID).First(&patient).Error; err != nil {
		http.Error(w, `{"error":"Pasien tidak ditemukan atau bukan milik akun Anda"}`, http.StatusNotFound)
		return
	}

	if req.Name != "" {
		patient.Name = strings.TrimSpace(req.Name)
	}
	if req.NIK != "" {
		patient.NIK = strings.TrimSpace(req.NIK)
	}
	if req.DOB != "" {
		patient.DOB = strings.TrimSpace(req.DOB)
	}
	if req.NoRM != "" {
		patient.NoRM = strings.TrimSpace(req.NoRM)
	}
	if req.Allergies != nil {
		arr := pq.StringArray{}
		for _, a := range req.Allergies {
			if trimmed := strings.TrimSpace(a); trimmed != "" {
				arr = append(arr, trimmed)
			}
		}
		patient.Allergies = arr
	}

	if err := db.DB.Save(&patient).Error; err != nil {
		http.Error(w, `{"error":"Gagal memperbarui data pasien: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(patient)
}
