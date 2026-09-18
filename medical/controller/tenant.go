package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

// GetTenantUserID extracts the user ID (tenant) from request header or query parameter
func GetTenantUserID(r *http.Request) (uint, error) {
	// 1. Check X-User-Id header
	hVal := strings.TrimSpace(r.Header.Get("X-User-Id"))
	if hVal != "" {
		id, err := strconv.Atoi(hVal)
		if err == nil && id > 0 {
			return uint(id), nil
		}
	}

	// 2. Check user_id query param
	qVal := strings.TrimSpace(r.URL.Query().Get("user_id"))
	if qVal != "" {
		id, err := strconv.Atoi(qVal)
		if err == nil && id > 0 {
			return uint(id), nil
		}
	}

	return 0, errors.New("identitas tenant (X-User-Id) diperlukan")
}
