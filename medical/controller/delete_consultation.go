package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strconv"
)

func HandleDeleteConsultation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, `{"error":"Parameter id diperlukan"}`, http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, `{"error":"ID konsultasi tidak valid"}`, http.StatusBadRequest)
		return
	}

	res := db.DB.Where("id = ? AND user_id = ?", id, tenantID).Delete(&model.Consultation{})
	if res.Error != nil {
		http.Error(w, `{"error":"Gagal menghapus konsultasi: `+res.Error.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if res.RowsAffected == 0 {
		http.Error(w, `{"error":"Konsultasi tidak ditemukan atau bukan milik akun Anda"}`, http.StatusNotFound)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "Konsultasi berhasil dihapus"})
}
