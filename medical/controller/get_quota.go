package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
)

type QuotaResponse struct {
	Used  int `json:"used"`
	Total int `json:"total"`
	Quota int `json:"quota"`
}

func HandleGetQuota(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	tenantID, err := GetTenantUserID(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}

	var user model.User
	if err := db.DB.First(&user, tenantID).Error; err != nil {
		http.Error(w, `{"error":"User tidak ditemukan"}`, http.StatusNotFound)
		return
	}

	total := 30
	quotaLeft := int(user.Quota)
	if quotaLeft < 0 {
		quotaLeft = 0
	}

	used := total - quotaLeft
	if used < 0 {
		used = 0
	}
	if used > total {
		used = total
	}

	_ = json.NewEncoder(w).Encode(QuotaResponse{
		Used:  used,
		Total: total,
		Quota: quotaLeft,
	})
}
