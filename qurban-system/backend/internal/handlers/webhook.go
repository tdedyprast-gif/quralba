package handlers

import (
	"context"
	"encoding/json"
	"io"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"qurban-backend/internal/database"
	"qurban-backend/internal/services"
)

// DoitWebhook menerima callback status pembayaran dari Doit.id.
// Referensi payload umum:
// {
//   "event": "invoice.paid",           // atau invoice.partial / invoice.expired
//   "id": "inv_xxx",                    // id invoice di doit
//   "external_id": "<peserta_uuid>",   // yang kita kirim saat create
//   "status": "PAID",                   // PAID | PARTIAL | EXPIRED | PENDING
//   "amount": 3500000,
//   "paid_amount": 3500000,
//   "timestamp": "2026-05-01T10:00:00Z"
// }
func DoitWebhook(c *fiber.Ctx) error {
	raw, err := io.ReadAll(io.NopCloser(strings.NewReader(string(c.Body()))))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "read body"})
	}

	// 1) Verifikasi signature (skip di dev bila secret kosong)
	sig := c.Get("X-Doit-Signature")
	if !services.VerifyWebhookSignature(raw, sig) {
		return c.Status(401).JSON(fiber.Map{"error": "invalid signature"})
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}

	event, _ := payload["event"].(string)
	invoiceID, _ := payload["id"].(string)
	externalID, _ := payload["external_id"].(string)
	status, _ := payload["status"].(string)
	amount, _ := payload["amount"].(float64)
	paidAmount, _ := payload["paid_amount"].(float64)

	// 2) Cari peserta by external_id (uuid) atau by doit_invoice_id sebagai fallback
	var pesertaID *string
	if externalID != "" {
		if _, err := uuid.Parse(externalID); err == nil {
			pid := externalID
			pesertaID = &pid
		}
	}
	if pesertaID == nil && invoiceID != "" {
		var pid string
		err := database.Pool.QueryRow(context.Background(),
			`SELECT id FROM peserta WHERE doit_invoice_id=$1`, invoiceID).Scan(&pid)
		if err == nil {
			pesertaID = &pid
		}
	}

	// 3) Simpan log transaksi (audit trail)
	rawJSON, _ := json.Marshal(payload)
	_, _ = database.Pool.Exec(context.Background(),
		`INSERT INTO transaksi_doit (peserta_id, doit_invoice_id, event, status, amount, raw_payload)
		 VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
		pesertaID, invoiceID, event, status, amount, string(rawJSON))

	// 4) Update status pembayaran peserta jika ditemukan
	if pesertaID != nil {
		newStatus := "belum_lunas"
		switch strings.ToUpper(status) {
		case "PAID", "SETTLED":
			newStatus = "lunas"
		case "PARTIAL", "PARTIALLY_PAID":
			newStatus = "cicilan"
		case "EXPIRED", "FAILED":
			newStatus = "belum_lunas"
		}
		terbayar := paidAmount
		if terbayar == 0 && newStatus == "lunas" {
			terbayar = amount
		}
		_, _ = database.Pool.Exec(context.Background(),
			`UPDATE peserta SET status_bayar=$1, total_terbayar=GREATEST(total_terbayar, $2) WHERE id=$3`,
			newStatus, terbayar, *pesertaID)
	}

	return c.JSON(fiber.Map{"ok": true})
}
