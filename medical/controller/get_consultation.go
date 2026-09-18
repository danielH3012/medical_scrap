package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strconv"
)

func HandleGetConsultations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	idStr := r.URL.Query().Get("id")
	if idStr != "" {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, `{"error":"ID konsultasi tidak valid"}`, http.StatusBadRequest)
			return
		}
		var c model.Consultation
		if err := db.DB.Where("id = ? AND user_id = ?", id, tenantID).First(&c).Error; err != nil {
			http.Error(w, `{"error":"Konsultasi tidak ditemukan atau bukan milik akun Anda"}`, http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(c.ToResponse())
		return
	}

	statusFilter := r.URL.Query().Get("status")
	patientIdStr := r.URL.Query().Get("patient_id")

	query := db.DB.Where("user_id = ?", tenantID).Order("id desc")

	if statusFilter == "active" {
		query = query.Where("status != ?", "Synced")
	} else if statusFilter == "synced" {
		query = query.Where("status = ?", "Synced")
	} else if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}

	if patientIdStr != "" {
		if pID, err := strconv.Atoi(patientIdStr); err == nil {
			query = query.Where("\"patientId\" = ?", pID)
		}
	}

	var list []model.Consultation
	if err := query.Find(&list).Error; err != nil {
		http.Error(w, `{"error":"Gagal mengambil data konsultasi: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	resList := make([]model.ConsultationResponse, 0, len(list))
	for _, it := range list {
		resList = append(resList, it.ToResponse())
	}

	_ = json.NewEncoder(w).Encode(resList)
}
