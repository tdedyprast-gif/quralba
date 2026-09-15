package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/models"
)

func randToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func ListPenerima(c *fiber.Ctx) error {
	rows, err := database.Pool.Query(context.Background(), `
		SELECT p.id, p.kode, p.nama, COALESCE(p.alamat,''), COALESCE(p.kategori,''), p.qr_token, p.created_at,
		       CASE WHEN d.id IS NULL THEN false ELSE true END AS diambil
		FROM penerima_daging p
		LEFT JOIN distribusi d ON d.penerima_id = p.id
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var out []models.PenerimaDaging
	for rows.Next() {
		var p models.PenerimaDaging
		if err := rows.Scan(&p.ID, &p.Kode, &p.Nama, &p.Alamat, &p.Kategori, &p.QRToken, &p.CreatedAt, &p.Diambil); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, p)
	}
	return c.JSON(out)
}

func CreatePenerima(c *fiber.Ctx) error {
	var p models.PenerimaDaging
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if p.Kode == "" {
		p.Kode = fmt.Sprintf("PN-%s", randToken(3))
	}
	p.QRToken = randToken(16)
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO penerima_daging (kode, nama, alamat, kategori, qr_token)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		p.Kode, p.Nama, p.Alamat, p.Kategori, p.QRToken).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(p)
}

// GetPenerimaQR — mengembalikan token yang akan di-encode ke QR image di frontend.
func GetPenerimaQR(c *fiber.Ctx) error {
	id := c.Params("id")
	var kode, nama, token string
	err := database.Pool.QueryRow(context.Background(),
		`SELECT kode, nama, qr_token FROM penerima_daging WHERE id=$1`, id).Scan(&kode, &nama, &token)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(fiber.Map{
		"kode":     kode,
		"nama":     nama,
		"qr_token": token,
		"qr_value": fmt.Sprintf("QURBAN|%s|%s", kode, token),
	})
}
