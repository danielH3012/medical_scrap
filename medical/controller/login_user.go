package controller

import (
	"encoding/json"
	"medical/db"
	"medical/model"
	"net/http"
	"strings"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func HandleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Format JSON tidak valid"}`, http.StatusBadRequest)
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)

	if req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"Username dan password wajib diisi"}`, http.StatusBadRequest)
		return
	}

	var user model.User
	err := db.DB.Where("LOWER(nama) = ? AND password = ?", strings.ToLower(req.Username), req.Password).First(&user).Error
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(LoginResponse{
			Success: false,
			Message: "Username atau password salah",
		})
		return
	}

	_ = json.NewEncoder(w).Encode(LoginResponse{
		Success:  true,
		Message:  "Login berhasil",
		ID:       user.ID,
		Username: user.Nama,
		Role:     "Master (all access)",
	})
}
