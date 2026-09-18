package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strconv"
	"strings"
)

func HandleGetPatients(w http.ResponseWriter, r *http.Request) {
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
			http.Error(w, `{"error":"ID pasien tidak valid"}`, http.StatusBadRequest)
			return
		}
		var patient model.Pasien
		if err := db.DB.Where("id = ? AND user_id = ?", id, tenantID).First(&patient).Error; err != nil {
			http.Error(w, `{"error":"Pasien tidak ditemukan atau bukan milik akun Anda"}`, http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(patient)
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("q"))
	var patients []model.Pasien
	dbQuery := db.DB.Where("user_id = ?", tenantID).Order("id asc")
	if query != "" {
		likeQuery := "%" + strings.ToLower(query) + "%"
		dbQuery = dbQuery.Where("(LOWER(name) LIKE ? OR LOWER(\"noRM\") LIKE ? OR nik LIKE ?)", likeQuery, likeQuery, likeQuery)
	}

	if err := dbQuery.Find(&patients).Error; err != nil {
		http.Error(w, `{"error":"Gagal mengambil data pasien: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	if patients == nil {
		patients = []model.Pasien{}
	}

	_ = json.NewEncoder(w).Encode(patients)
}
