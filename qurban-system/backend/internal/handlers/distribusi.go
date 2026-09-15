package handlers

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/models"
	"qurban-backend/internal/ws"
)

func ListDistribusi(c *fiber.Ctx) error {
	rows, err := database.Pool.Query(context.Background(), `
		SELECT d.id, d.penerima_id, d.diambil_at, d.petugas_id, COALESCE(d.catatan,''),
		       p.nama, COALESCE(u.nama,'')
		FROM distribusi d
		JOIN penerima_daging p ON p.id = d.penerima_id
		LEFT JOIN users u ON u.id = d.petugas_id
		ORDER BY d.diambil_at DESC
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var out []models.Distribusi
	for rows.Next() {
		var d models.Distribusi
		if err := rows.Scan(&d.ID, &d.PenerimaID, &d.DiambilAt, &d.PetugasID, &d.Catatan, &d.NamaPenerima, &d.NamaPetugas); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, d)
	}
	return c.JSON(out)
}

type scanReq struct {
	QRValue string `json:"qr_value"`
	Catatan string `json:"catatan"`
}

// ScanQR — dipanggil frontend saat panitia scan QR di HP.
// Broadcast event via WebSocket ke semua dashboard yang terhubung.
func ScanQR(hub *ws.Hub) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var r scanReq
		if err := c.BodyParser(&r); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
		}
		// format: QURBAN|<kode>|<token>  atau langsung token
		token := r.QRValue
		if strings.HasPrefix(r.QRValue, "QURBAN|") {
			parts := strings.Split(r.QRValue, "|")
			if len(parts) == 3 {
				token = parts[2]
			}
		}
		var penerimaID, kode, nama string
		err := database.Pool.QueryRow(context.Background(),
			`SELECT id, kode, nama FROM penerima_daging WHERE qr_token=$1`, token).
			Scan(&penerimaID, &kode, &nama)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "QR tidak dikenali"})
		}

		// cek apakah sudah pernah diambil
		var existing string
		err = database.Pool.QueryRow(context.Background(),
			`SELECT id FROM distribusi WHERE penerima_id=$1`, penerimaID).Scan(&existing)
		if err == nil {
			return c.Status(409).JSON(fiber.Map{
				"error": "Sudah pernah diambil",
				"penerima": fiber.Map{"kode": kode, "nama": nama},
			})
		}

		petugasID, _ := c.Locals("uid").(string)
		var distID string
		err = database.Pool.QueryRow(context.Background(),
			`INSERT INTO distribusi (penerima_id, petugas_id, catatan) VALUES ($1,$2,$3) RETURNING id`,
			penerimaID, petugasID, r.Catatan).Scan(&distID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		payload := fiber.Map{
			"distribusi_id": distID,
			"penerima_id":   penerimaID,
			"kode":          kode,
			"nama":          nama,
		}
		// Broadcast realtime ke dashboard
		hub.BroadcastJSON("distribusi.scan", payload)

		return c.JSON(fiber.Map{"ok": true, "data": payload})
	}
}

// DistribusiStats — ringkasan progres distribusi (untuk dashboard)
func DistribusiStats(c *fiber.Ctx) error {
	var total, taken int
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM penerima_daging`).Scan(&total)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM distribusi`).Scan(&taken)

	var pesertaTotal, pesertaLunas int
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM peserta`).Scan(&pesertaTotal)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM peserta WHERE status_bayar='lunas'`).Scan(&pesertaLunas)

	var totalBayar, totalTerbayar float64
	_ = database.Pool.QueryRow(context.Background(), `SELECT COALESCE(SUM(total_bayar),0), COALESCE(SUM(total_terbayar),0) FROM peserta`).Scan(&totalBayar, &totalTerbayar)

	return c.JSON(fiber.Map{
		"penerima_total":  total,
		"penerima_taken":  taken,
		"peserta_total":   pesertaTotal,
		"peserta_lunas":   pesertaLunas,
		"total_tagihan":   totalBayar,
		"total_terbayar":  totalTerbayar,
	})
}

func ListTransaksi(c *fiber.Ctx) error {
	rows, err := database.Pool.Query(context.Background(), `
		SELECT id, peserta_id, COALESCE(doit_invoice_id,''), COALESCE(event,''), COALESCE(status,''), COALESCE(amount,0), raw_payload::text, received_at
		FROM transaksi_doit ORDER BY received_at DESC LIMIT 200
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var out []models.TransaksiDoit
	for rows.Next() {
		var t models.TransaksiDoit
		if err := rows.Scan(&t.ID, &t.PesertaID, &t.DoitInvoiceID, &t.Event, &t.Status, &t.Amount, &t.RawPayload, &t.ReceivedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, t)
	}
	return c.JSON(out)
}
