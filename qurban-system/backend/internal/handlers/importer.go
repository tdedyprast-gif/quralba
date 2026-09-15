package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"

	"qurban-backend/internal/database"
)

func rndHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ImportPenerima — expect .xlsx dengan header: kode, nama, alamat, kategori
func ImportPenerima(c *fiber.Ctx) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "field 'file' wajib"})
	}
	f, err := fh.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	defer f.Close()

	xf, err := excelize.OpenReader(f)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "gagal baca xlsx: " + err.Error()})
	}
	sheet := xf.GetSheetName(0)
	rows, err := xf.GetRows(sheet)
	if err != nil || len(rows) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "sheet kosong / invalid"})
	}
	inserted := 0
	for i, row := range rows {
		if i == 0 {
			continue // header
		}
		if len(row) < 2 {
			continue
		}
		kode := getCell(row, 0)
		nama := getCell(row, 1)
		alamat := getCell(row, 2)
		kategori := getCell(row, 3)
		if kode == "" {
			kode = fmt.Sprintf("PN-%s", rndHex(3))
		}
		token := rndHex(16)
		_, err := database.Pool.Exec(context.Background(),
			`INSERT INTO penerima_daging (kode, nama, alamat, kategori, qr_token)
			 VALUES ($1,$2,$3,$4,$5) ON CONFLICT (kode) DO NOTHING`,
			kode, nama, alamat, kategori, token)
		if err == nil {
			inserted++
		}
	}
	return c.JSON(fiber.Map{"ok": true, "inserted": inserted})
}

// ImportPeserta — expect header: nama, no_hp, alamat, email, paket_nama
func ImportPeserta(c *fiber.Ctx) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "field 'file' wajib"})
	}
	f, err := fh.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	defer f.Close()

	xf, err := excelize.OpenReader(f)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	rows, err := xf.GetRows(xf.GetSheetName(0))
	if err != nil || len(rows) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "sheet kosong"})
	}
	inserted := 0
	for i, row := range rows {
		if i == 0 {
			continue
		}
		nama := getCell(row, 0)
		noHP := getCell(row, 1)
		alamat := getCell(row, 2)
		email := getCell(row, 3)
		paketNama := getCell(row, 4)

		if nama == "" {
			continue
		}
		var paketID *string
		var harga float64
		if paketNama != "" {
			var pid string
			err := database.Pool.QueryRow(context.Background(),
				`SELECT id, harga_per_orang FROM paket_sapi WHERE nama=$1 LIMIT 1`, paketNama).
				Scan(&pid, &harga)
			if err == nil {
				paketID = &pid
			}
		}
		_, err := database.Pool.Exec(context.Background(),
			`INSERT INTO peserta (nama, no_hp, alamat, email, paket_id, total_bayar) VALUES ($1,$2,$3,$4,$5,$6)`,
			nama, noHP, alamat, email, paketID, harga)
		if err == nil {
			inserted++
		}
	}
	return c.JSON(fiber.Map{"ok": true, "inserted": inserted})
}

func getCell(row []string, idx int) string {
	if idx < len(row) {
		return row[idx]
	}
	return ""
}
