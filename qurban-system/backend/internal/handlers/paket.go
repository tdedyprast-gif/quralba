package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/models"
)

func ListPaket(c *fiber.Ctx) error {
	rows, err := database.Pool.Query(context.Background(),
		`SELECT id, nama, jenis, max_shohibul, harga_per_orang, COALESCE(deskripsi,''), created_at FROM paket_sapi ORDER BY created_at DESC`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var out []models.PaketSapi
	for rows.Next() {
		var p models.PaketSapi
		if err := rows.Scan(&p.ID, &p.Nama, &p.Jenis, &p.MaxShohibul, &p.HargaPerOrang, &p.Deskripsi, &p.CreatedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, p)
	}
	return c.JSON(out)
}

func CreatePaket(c *fiber.Ctx) error {
	var p models.PaketSapi
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if p.MaxShohibul == 0 {
		p.MaxShohibul = 1
	}
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO paket_sapi (nama, jenis, max_shohibul, harga_per_orang, deskripsi)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		p.Nama, p.Jenis, p.MaxShohibul, p.HargaPerOrang, p.Deskripsi).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(p)
}

func UpdatePaket(c *fiber.Ctx) error {
	id := c.Params("id")
	var p models.PaketSapi
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	_, err := database.Pool.Exec(context.Background(),
		`UPDATE paket_sapi SET nama=$1, jenis=$2, max_shohibul=$3, harga_per_orang=$4, deskripsi=$5 WHERE id=$6`,
		p.Nama, p.Jenis, p.MaxShohibul, p.HargaPerOrang, p.Deskripsi, id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func DeletePaket(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := database.Pool.Exec(context.Background(), `DELETE FROM paket_sapi WHERE id=$1`, id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}
