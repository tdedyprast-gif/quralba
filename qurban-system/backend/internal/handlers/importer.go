package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"

	"qurban-backend/internal/database"
)

func rndHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// kolom template import penerima (urutan wajib sama dengan parser)
var templatePenerimaHeaders = []string{"kode", "nama", "alamat", "kategori", "no_hp", "latitude", "longitude"}

// ImportPenerima — expect .xlsx dengan header:
// kode | nama | alamat | kategori | no_hp | latitude | longitude
// Baris dengan kode yang sudah ada akan dilewati (ON CONFLICT DO NOTHING).
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
		return c.Status(400).JSON(fiber.Map{"error": "sheet kosong / tidak ada data"})
	}

	inserted, skipped, failed := 0, 0, 0
	errList := []string{}

	for i, row := range rows {
		if i == 0 {
			continue // header
		}
		nama := getCell(row, 1)
		if strings.TrimSpace(nama) == "" {
			continue // baris tanpa nama dilewati
		}
		kode := strings.TrimSpace(getCell(row, 0))
		if kode == "" {
			kode = fmt.Sprintf("PN-%s", rndHex(3))
		}
		alamat := getCell(row, 2)
		kategori := getCell(row, 3)
		if kategori == "" {
			kategori = "fakir"
		}
		noHP := getCell(row, 4)
		lat := parseFloatPtr(getCell(row, 5))
		lng := parseFloatPtr(getCell(row, 6))

		tag, err := database.Pool.Exec(context.Background(),
			`INSERT INTO penerima_daging (kode, nama, alamat, kategori, no_hp, qr_token, latitude, longitude)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (kode) DO NOTHING`,
			kode, nama, alamat, kategori, noHP, rndHex(16), lat, lng)
		if err != nil {
			failed++
			if len(errList) < 10 {
				errList = append(errList, fmt.Sprintf("baris %d: %s", i+1, err.Error()))
			}
			continue
		}
		if tag.RowsAffected() == 0 {
			skipped++ // kode duplikat
		} else {
			inserted++
		}
	}

	return c.JSON(fiber.Map{
		"ok":       true,
		"inserted": inserted,
		"skipped":  skipped,
		"failed":   failed,
		"errors":   errList,
	})
}

// ImportPeserta — header: nama, no_hp, alamat, email, paket_nama
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

// DownloadTemplatePenerima — unduh file .xlsx contoh untuk import data penerima.
func DownloadTemplatePenerima(c *fiber.Ctx) error {
	xf := excelize.NewFile()
	defer xf.Close()

	dataSheet := "Penerima"
	guideSheet := "Panduan"

	// Sheet data + header
	xf.SetSheetName("Sheet1", dataSheet)
	headerStyle, _ := xf.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"047857"}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	for i, h := range templatePenerimaHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		xf.SetCellValue(dataSheet, cell, h)
		xf.SetCellStyle(dataSheet, cell, cell, headerStyle)
	}
	// Contoh baris
	samples := [][]interface{}{
		{"PN-001", "Ahmad Fauzi", "Jl. Merdeka No. 10, Bandung", "fakir", "081234567890", -6.917464, 107.619123},
		{"PN-002", "Siti Aminah", "Jl. Sudirman No. 5, Bandung", "miskin", "081298765432", -6.914744, 107.609810},
		{"", "Budi Santoso", "Jl. Asia Afrika No. 1, Bandung", "tetangga", "", "", ""},
	}
	for r, s := range samples {
		for cIdx, v := range s {
			cell, _ := excelize.CoordinatesToCellName(cIdx+1, r+2)
			xf.SetCellValue(dataSheet, cell, v)
		}
	}
	xf.SetColWidth(dataSheet, "A", "A", 14)
	xf.SetColWidth(dataSheet, "B", "B", 24)
	xf.SetColWidth(dataSheet, "C", "C", 34)
	xf.SetColWidth(dataSheet, "D", "D", 14)
	xf.SetColWidth(dataSheet, "E", "E", 16)
	xf.SetColWidth(dataSheet, "F", "G", 14)

	// Sheet panduan
	xf.NewSheet(guideSheet)
	guide := [][]interface{}{
		{"PANDUAN IMPORT DATA PENERIMA DAGING"},
		{""},
		{"1. Isi data pada sheet 'Penerima'. Jangan mengubah nama kolom di baris pertama."},
		{"2. Kolom 'nama' wajib diisi. Baris tanpa nama akan dilewati."},
		{"3. Kolom 'kode' boleh dikosongkan — sistem akan membuat kode otomatis (PN-xxxx)."},
		{"4. Jika kode sudah terdaftar, baris tersebut dilewati (tidak menimpa data lama)."},
		{"5. Kolom 'kategori' pilihan: fakir, miskin, tetangga, panitia, penerima. Default: fakir."},
		{"6. Kolom 'latitude' & 'longitude' opsional — untuk tampil di peta distribusi."},
		{"7. Simpan sebagai .xlsx lalu unggah melalui tombol Import XLSX."},
		{""},
		{"Daftar kolom:"},
		{"kode", "Kode unik penerima (opsional)"},
		{"nama", "Nama lengkap penerima (WAJIB)"},
		{"alamat", "Alamat lengkap"},
		{"kategori", "fakir / miskin / tetangga / panitia / penerima"},
		{"no_hp", "Nomor HP/WhatsApp"},
		{"latitude", "Koordinat lintang, contoh: -6.917464"},
		{"longitude", "Koordinat bujur, contoh: 107.619123"},
	}
	for r, row := range guide {
		for cIdx, v := range row {
			cell, _ := excelize.CoordinatesToCellName(cIdx+1, r+1)
			xf.SetCellValue(guideSheet, cell, v)
		}
	}
	xf.SetColWidth(guideSheet, "A", "A", 16)
	xf.SetColWidth(guideSheet, "B", "B", 70)

	xf.SetActiveSheet(0)

	buf, err := xf.WriteToBuffer()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", `attachment; filename="template-import-penerima.xlsx"`)
	return c.Send(buf.Bytes())
}

func getCell(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

func parseFloatPtr(s string) *float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}
