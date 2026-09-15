package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"qurban-backend/internal/config"
)

// DoitInvoiceRequest — payload untuk membuat tagihan di Doit.id
type DoitInvoiceRequest struct {
	ExternalID  string  `json:"external_id"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	PayerName   string  `json:"payer_name"`
	PayerEmail  string  `json:"payer_email,omitempty"`
	PayerPhone  string  `json:"payer_phone,omitempty"`
	CallbackURL string  `json:"callback_url"`
	SuccessURL  string  `json:"success_url,omitempty"`
	ExpiryHours int     `json:"expiry_hours,omitempty"`
}

// DoitInvoiceResponse — respons dari Doit.id (sesuaikan dengan doc resmi)
type DoitInvoiceResponse struct {
	ID         string  `json:"id"`
	ExternalID string  `json:"external_id"`
	Status     string  `json:"status"`
	Amount     float64 `json:"amount"`
	InvoiceURL string  `json:"invoice_url"`
	ExpiresAt  string  `json:"expires_at"`
}

// CreateInvoice memanggil Doit.id API untuk membuat tagihan baru.
// NOTE: Ini stub-friendly. Jika DOIT_API_KEY masih SANDBOX, kita fake response.
func CreateInvoice(req DoitInvoiceRequest) (*DoitInvoiceResponse, error) {
	cfg := config.Get()

	// STUB mode — untuk memudahkan development lokal
	if cfg.DoitAPIKey == "" || cfg.DoitAPIKey == "SANDBOX_KEY_REPLACE_ME" {
		return &DoitInvoiceResponse{
			ID:         "stub-" + req.ExternalID,
			ExternalID: req.ExternalID,
			Status:     "PENDING",
			Amount:     req.Amount,
			InvoiceURL: "https://sandbox.doit.id/checkout/stub-" + req.ExternalID,
			ExpiresAt:  time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		}, nil
	}

	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequest("POST", cfg.DoitBaseURL+"/invoices", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+cfg.DoitAPIKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("doit api error %d: %s", resp.StatusCode, string(b))
	}
	var out DoitInvoiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

// VerifyWebhookSignature validasi HMAC signature header X-Doit-Signature (sha256).
// Sesuaikan skema signature dengan dokumentasi doit.id.
func VerifyWebhookSignature(rawBody []byte, signatureHeader string) bool {
	cfg := config.Get()
	if cfg.DoitWebhookSecret == "" {
		return true // dev mode
	}
	mac := hmac.New(sha256.New, []byte(cfg.DoitWebhookSecret))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signatureHeader))
}
