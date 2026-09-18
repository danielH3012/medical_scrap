package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strconv"
)

func HandleDeletePatient(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, `{"error":"ID pasien tidak valid"}`, http.StatusBadRequest)
		return
	}

	// Hapus konsultasi milik pasien yang bersangkutan untuk tenant ini
	_ = db.DB.Where("\"patientId\" = ? AND user_id = ?", id, tenantID).Delete(&model.Consultation{}).Error

	res := db.DB.Where("id = ? AND user_id = ?", id, tenantID).Delete(&model.Pasien{})
	if res.Error != nil {
		http.Error(w, `{"error":"Gagal menghapus data pasien: `+res.Error.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if res.RowsAffected == 0 {
		http.Error(w, `{"error":"Pasien tidak ditemukan atau bukan milik akun Anda"}`, http.StatusNotFound)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "Pasien berhasil dihapus"})
}
