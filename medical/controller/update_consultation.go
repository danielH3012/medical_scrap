package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strconv"
	"strings"
)

type UpdateConsultationRequest struct {
	ID           uint                     `json:"id"`
	Status       string                   `json:"status"`
	SOAP         *model.SOAPDTO           `json:"soap"`
	Prescription *[]model.PrescriptionDTO `json:"prescription"`
}

func HandleUpdateConsultation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	var req UpdateConsultationRequest
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
		http.Error(w, `{"error":"ID konsultasi diperlukan"}`, http.StatusBadRequest)
		return
	}

	var consult model.Consultation
	if err := db.DB.Where("id = ? AND user_id = ?", req.ID, tenantID).First(&consult).Error; err != nil {
		http.Error(w, `{"error":"Konsultasi tidak ditemukan atau bukan milik akun Anda"}`, http.StatusNotFound)
		return
	}

	if strings.TrimSpace(req.Status) != "" {
		newStatus := strings.TrimSpace(req.Status)
		if newStatus == "Synced" && consult.Status != "Synced" {
			var user model.User
			if err := db.DB.First(&user, tenantID).Error; err != nil {
				http.Error(w, `{"error":"User tidak ditemukan"}`, http.StatusNotFound)
				return
			}
			if user.Quota <= 0 {
				http.Error(w, `{"error":"Kuota Scribe Anda telah habis (0 tersisa). Silakan hubungi administrator."}`, http.StatusBadRequest)
				return
			}

			// Kurangi kolom quota di tabel user sebanyak 1
			if err := db.DB.Model(&model.User{}).Where("id = ? AND quota > 0", tenantID).Update("quota", user.Quota-1).Error; err != nil {
				http.Error(w, `{"error":"Gagal memperbarui kuota user: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
		consult.Status = newStatus
	}

	if req.SOAP != nil {
		consult.SetSOAP(*req.SOAP)
	}

	if req.Prescription != nil {
		consult.SetPrescription(*req.Prescription)
	}

	if err := db.DB.Save(&consult).Error; err != nil {
		http.Error(w, `{"error":"Gagal memperbarui data konsultasi: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(consult.ToResponse())
}
