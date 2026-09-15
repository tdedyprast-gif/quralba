package handlers

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/config"
	"qurban-backend/internal/database"
	"qurban-backend/internal/models"
	"qurban-backend/internal/services"
)

func ListPeserta(c *fiber.Ctx) error {
	rows, err := database.Pool.Query(context.Background(), `
		SELECT p.id, p.nama, COALESCE(p.no_hp,''), COALESCE(p.alamat,''), COALESCE(p.email,''),
		       p.paket_id, p.slot_ke, p.total_bayar, p.total_terbayar, p.status_bayar,
		       p.doit_invoice_id, p.doit_invoice_url, p.created_at, ps.nama
		FROM peserta p LEFT JOIN paket_sapi ps ON ps.id = p.paket_id
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var out []models.Peserta
	for rows.Next() {
		var p models.Peserta
		if err := rows.Scan(&p.ID, &p.Nama, &p.NoHP, &p.Alamat, &p.Email,
			&p.PaketID, &p.SlotKe, &p.TotalBayar, &p.TotalTerbayar, &p.StatusBayar,
			&p.DoitInvoiceID, &p.DoitInvoiceURL, &p.CreatedAt, &p.PaketNama); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, p)
	}
	return c.JSON(out)
}

func CreatePeserta(c *fiber.Ctx) error {
	var p models.Peserta
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if p.Nama == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nama wajib"})
	}
	if p.SlotKe == 0 {
		p.SlotKe = 1
	}
	// hitung total_bayar dari paket jika tersedia
	if p.PaketID != nil && p.TotalBayar == 0 {
		var harga float64
		_ = database.Pool.QueryRow(context.Background(),
			`SELECT harga_per_orang FROM paket_sapi WHERE id=$1`, *p.PaketID).Scan(&harga)
		p.TotalBayar = harga
	}
	err := database.Pool.QueryRow(context.Background(), `
		INSERT INTO peserta (nama, no_hp, alamat, email, paket_id, slot_ke, total_bayar, total_terbayar, status_bayar)
		VALUES ($1,$2,$3,$4,$5,$6,$7,0,'belum_lunas') RETURNING id, created_at`,
		p.Nama, p.NoHP, p.Alamat, p.Email, p.PaketID, p.SlotKe, p.TotalBayar).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	p.StatusBayar = "belum_lunas"
	return c.Status(201).JSON(p)
}

func GetPeserta(c *fiber.Ctx) error {
	id := c.Params("id")
	var p models.Peserta
	err := database.Pool.QueryRow(context.Background(), `
		SELECT id, nama, COALESCE(no_hp,''), COALESCE(alamat,''), COALESCE(email,''),
		       paket_id, slot_ke, total_bayar, total_terbayar, status_bayar,
		       doit_invoice_id, doit_invoice_url, created_at
		FROM peserta WHERE id=$1`, id).
		Scan(&p.ID, &p.Nama, &p.NoHP, &p.Alamat, &p.Email, &p.PaketID, &p.SlotKe,
			&p.TotalBayar, &p.TotalTerbayar, &p.StatusBayar, &p.DoitInvoiceID, &p.DoitInvoiceURL, &p.CreatedAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(p)
}

func UpdatePeserta(c *fiber.Ctx) error {
	id := c.Params("id")
	var p models.Peserta
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	_, err := database.Pool.Exec(context.Background(), `
		UPDATE peserta SET nama=$1, no_hp=$2, alamat=$3, email=$4, paket_id=$5, slot_ke=$6, total_bayar=$7
		WHERE id=$8`,
		p.Nama, p.NoHP, p.Alamat, p.Email, p.PaketID, p.SlotKe, p.TotalBayar, id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func DeletePeserta(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := database.Pool.Exec(context.Background(), `DELETE FROM peserta WHERE id=$1`, id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// CreateInvoice — panggil Doit.id untuk membuat tagihan dan simpan kembali ke peserta
func CreateInvoice(c *fiber.Ctx) error {
	id := c.Params("id")
	cfg := config.Get()

	var p models.Peserta
	err := database.Pool.QueryRow(context.Background(),
		`SELECT id, nama, COALESCE(email,''), COALESCE(no_hp,''), total_bayar FROM peserta WHERE id=$1`, id).
		Scan(&p.ID, &p.Nama, &p.Email, &p.NoHP, &p.TotalBayar)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "peserta tidak ditemukan"})
	}
	if p.TotalBayar <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "total bayar 0 - set paket dulu"})
	}
	callback := fmt.Sprintf("%s/api/webhook/doit", cfg.DoitBaseURL) // ganti di frontend/env kalau perlu
	if v := c.Get("X-Callback-Base"); v != "" {
		callback = v + "/api/webhook/doit"
	}

	inv, err := services.CreateInvoice(services.DoitInvoiceRequest{
		ExternalID:  p.ID,
		Amount:      p.TotalBayar,
		Description: "Pembayaran Qurban - " + p.Nama,
		PayerName:   p.Nama,
		PayerEmail:  p.Email,
		PayerPhone:  p.NoHP,
		CallbackURL: callback,
		ExpiryHours: 48,
	})
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	_, _ = database.Pool.Exec(context.Background(),
		`UPDATE peserta SET doit_invoice_id=$1, doit_invoice_url=$2 WHERE id=$3`,
		inv.ID, inv.InvoiceURL, id)

	// log transaksi
	_, _ = database.Pool.Exec(context.Background(),
		`INSERT INTO transaksi_doit (peserta_id, doit_invoice_id, event, status, amount, raw_payload)
		 VALUES ($1,$2,'invoice.created',$3,$4,$5::jsonb)`,
		id, inv.ID, inv.Status, inv.Amount, `{}`)

	return c.JSON(inv)
}
