package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strings"
)

type CreateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateUserResponse struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Format data JSON tidak valid"}`, http.StatusBadRequest)
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)

	if req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"Username dan password wajib diisi"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 4 {
		http.Error(w, `{"error":"Password minimal 4 karakter"}`, http.StatusBadRequest)
		return
	}

	// Cek apakah username sudah terdaftar di PostgreSQL
	var count int64
	db.DB.Model(&model.User{}).Where("LOWER(nama) = ?", strings.ToLower(req.Username)).Count(&count)
	if count > 0 {
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": "Username sudah digunakan, silakan pilih username lain",
		})
		return
	}

	newUser := model.User{
		Nama:     req.Username,
		Password: req.Password,
		Quota:    30,
	}

	if err := db.DB.Create(&newUser).Error; err != nil {
		http.Error(w, `{"error":"Gagal mendaftarkan user ke database: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(CreateUserResponse{
		Success:  true,
		Message:  "Pendaftaran user berhasil",
		ID:       newUser.ID,
		Username: newUser.Nama,
		Role:     "Master (all access)",
	})
}
