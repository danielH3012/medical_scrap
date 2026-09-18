package controller

import (
	"encoding/json"
	"fmt"
	"medical/db"
	"medical/model"
	"net/http"
	"strings"
	"time"

	"github.com/lib/pq"
)

type CreatePatientRequest struct {
	NoRM      string   `json:"noRM"`
	Name      string   `json:"name"`
	NIK       string   `json:"nik"`
	DOB       string   `json:"dob"`
	Allergies []string `json:"allergies"`
}

func HandleCreatePatient(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	var req CreatePatientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Format data JSON tidak valid: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, `{"error":"Nama pasien wajib diisi"}`, http.StatusBadRequest)
		return
	}

	noRM := strings.TrimSpace(req.NoRM)
	if noRM == "" {
		var count int64
		db.DB.Model(&model.Pasien{}).Where("user_id = ?", tenantID).Count(&count)
		year := time.Now().Year()
		noRM = fmt.Sprintf("RM-%d-%04d", year, count+1)
	}

	allergiesArr := pq.StringArray{}
	if req.Allergies != nil {
		for _, a := range req.Allergies {
			trimmed := strings.TrimSpace(a)
			if trimmed != "" {
				allergiesArr = append(allergiesArr, trimmed)
			}
		}
	}

	patient := model.Pasien{
		NoRM:      noRM,
		Name:      req.Name,
		NIK:       strings.TrimSpace(req.NIK),
		DOB:       strings.TrimSpace(req.DOB),
		Allergies: allergiesArr,
		UserID:    tenantID,
	}

	if err := db.DB.Create(&patient).Error; err != nil {
		http.Error(w, `{"error":"Gagal menyimpan pasien ke database: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(patient)
}
