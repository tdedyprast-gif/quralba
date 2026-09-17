package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/models"
)

// recalcPeserta — hitung ulang total_terbayar & status_bayar dari tabel pembayaran.
// Dipanggil setiap kali pembayaran ditambah / dihapus.
func recalcPeserta(ctx context.Context, pesertaID string) error {
	var totalBayar, totalTerbayar float64
	if err := database.Pool.QueryRow(ctx,
		`SELECT total_bayar FROM peserta WHERE id=$1`, pesertaID).Scan(&totalBayar); err != nil {
		return err
	}
	_ = database.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount),0) FROM pembayaran WHERE peserta_id=$1`, pesertaID).Scan(&totalTerbayar)

	status := "belum_lunas"
	switch {
	case totalBayar > 0 && totalTerbayar >= totalBayar:
		status = "lunas"
	case totalTerbayar > 0:
		status = "cicilan"
	}

	_, err := database.Pool.Exec(ctx,
		`UPDATE peserta SET total_terbayar=$1, status_bayar=$2 WHERE id=$3`,
		totalTerbayar, status, pesertaID)
	return err
}

// ListPembayaran — riwayat pembayaran. Filter opsional: ?peserta_id=xxx
func ListPembayaran(c *fiber.Ctx) error {
	pesertaID := c.Query("peserta_id")

	q := `SELECT pb.id, pb.peserta_id, pb.amount, pb.metode, COALESCE(pb.referensi,''),
	             COALESCE(pb.catatan,''), pb.petugas_id, pb.paid_at, pb.created_at,
	             p.nama, COALESCE(u.nama,'')
	      FROM pembayaran pb
	      JOIN peserta p ON p.id = pb.peserta_id
	      LEFT JOIN users u ON u.id = pb.petugas_id`
	args := []interface{}{}
	if pesertaID != "" {
		q += " WHERE pb.peserta_id=$1"
		args = append(args, pesertaID)
	}
	q += " ORDER BY pb.paid_at DESC LIMIT 500"

	rows, err := database.Pool.Query(context.Background(), q, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var out []models.Pembayaran
	for rows.Next() {
		var p models.Pembayaran
		if err := rows.Scan(&p.ID, &p.PesertaID, &p.Amount, &p.Metode, &p.Referensi,
			&p.Catatan, &p.PetugasID, &p.PaidAt, &p.CreatedAt, &p.NamaPeserta, &p.NamaPetugas); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, p)
	}
	return c.JSON(out)
}

type pembayaranReq struct {
	PesertaID string  `json:"peserta_id"`
	Amount    float64 `json:"amount"`
	Metode    string  `json:"metode"`
	Referensi string  `json:"referensi"`
	Catatan   string  `json:"catatan"`
	PaidAt    string  `json:"paid_at"`
}

// CreatePembayaran — pencatatan pembayaran oleh panitia bendahara.
func CreatePembayaran(c *fiber.Ctx) error {
	var r pembayaranReq
	if err := c.BodyParser(&r); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if r.PesertaID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "peserta_id wajib"})
	}
	if r.Amount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "jumlah pembayaran harus lebih dari 0"})
	}
	if r.Metode == "" {
		r.Metode = "tunai"
	}
	switch r.Metode {
	case "tunai", "transfer", "qris", "doit":
	default:
		return c.Status(400).JSON(fiber.Map{"error": "metode harus tunai/transfer/qris/doit"})
	}

	paidAt := time.Now()
	if r.PaidAt != "" {
		if t, err := time.Parse(time.RFC3339, r.PaidAt); err == nil {
			paidAt = t
		}
	}

	petugasID, _ := c.Locals("uid").(string)
	ctx := context.Background()

	var id string
	err := database.Pool.QueryRow(ctx, `
		INSERT INTO pembayaran (peserta_id, amount, metode, referensi, catatan, petugas_id, paid_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		r.PesertaID, r.Amount, r.Metode, r.Referensi, r.Catatan, petugasID, paidAt).Scan(&id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	if err := recalcPeserta(ctx, r.PesertaID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "pembayaran tersimpan tapi gagal recalc: " + err.Error()})
	}

	var status string
	var terbayar, total float64
	_ = database.Pool.QueryRow(ctx,
		`SELECT status_bayar, total_terbayar, total_bayar FROM peserta WHERE id=$1`,
		r.PesertaID).Scan(&status, &terbayar, &total)

	return c.Status(201).JSON(fiber.Map{
		"ok": true, "id": id,
		"status_bayar": status, "total_terbayar": terbayar, "total_bayar": total,
	})
}

// DeletePembayaran — hapus catatan pembayaran lalu hitung ulang status peserta.
func DeletePembayaran(c *fiber.Ctx) error {
	id := c.Params("id")
	ctx := context.Background()

	var pesertaID string
	err := database.Pool.QueryRow(ctx,
		`SELECT peserta_id FROM pembayaran WHERE id=$1`, id).Scan(&pesertaID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "pembayaran tidak ditemukan"})
	}

	if _, err := database.Pool.Exec(ctx, `DELETE FROM pembayaran WHERE id=$1`, id); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if err := recalcPeserta(ctx, pesertaID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// RekapPembayaran — ringkasan penerimaan kas untuk bendahara.
func RekapPembayaran(c *fiber.Ctx) error {
	ctx := context.Background()
	out := fiber.Map{}

	var totalMasuk float64
	_ = database.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount),0) FROM pembayaran`).Scan(&totalMasuk)
	out["total_masuk"] = totalMasuk

	var totalTagihan float64
	_ = database.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(total_bayar),0) FROM peserta`).Scan(&totalTagihan)
	out["total_tagihan"] = totalTagihan
	out["outstanding"] = totalTagihan - totalMasuk

	rows, err := database.Pool.Query(ctx,
		`SELECT metode, COALESCE(SUM(amount),0), COUNT(*) FROM pembayaran GROUP BY metode ORDER BY metode`)
	perMetode := []fiber.Map{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var metode string
			var sum float64
			var n int
			if err := rows.Scan(&metode, &sum, &n); err == nil {
				perMetode = append(perMetode, fiber.Map{"metode": metode, "total": sum, "jumlah": n})
			}
		}
	}
	out["per_metode"] = perMetode

	var lunas, cicilan, belum int
	_ = database.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM peserta WHERE status_bayar='lunas'`).Scan(&lunas)
	_ = database.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM peserta WHERE status_bayar='cicilan'`).Scan(&cicilan)
	_ = database.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM peserta WHERE status_bayar='belum_lunas'`).Scan(&belum)
	out["peserta_lunas"] = lunas
	out["peserta_cicilan"] = cicilan
	out["peserta_belum_lunas"] = belum

	return c.JSON(out)
}
