package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jung-kurt/gofpdf"

	"qurban-backend/internal/database"
)

// SertifikatPenerima — PDF sertifikat penerimaan daging qurban (siap cetak A5 landscape)
func SertifikatPenerima(c *fiber.Ctx) error {
	id := c.Params("id")

	var kode, nama, alamat, kategori string
	var petugas sql.NullString
	var diambilAt sql.NullTime
	err := database.Pool.QueryRow(context.Background(), `
		SELECT p.kode, p.nama, COALESCE(p.alamat,''), COALESCE(p.kategori,''),
		       d.diambil_at, u.nama
		FROM penerima_daging p
		LEFT JOIN distribusi d ON d.penerima_id = p.id
		LEFT JOIN users u ON u.id = d.petugas_id
		WHERE p.id=$1`, id).
		Scan(&kode, &nama, &alamat, &kategori, &diambilAt, &petugas)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "penerima tidak ditemukan"})
	}

	pdf := gofpdf.New("L", "mm", "A5", "") // Landscape A5 = 210 x 148 mm
	pdf.SetMargins(10, 10, 10)
	pdf.AddPage()

	// Frame dekoratif
	pdf.SetDrawColor(5, 150, 105) // primary green
	pdf.SetLineWidth(1.2)
	pdf.Rect(6, 6, 198, 136, "D")
	pdf.SetLineWidth(0.3)
	pdf.Rect(9, 9, 192, 130, "D")

	// Judul
	pdf.SetY(20)
	pdf.SetFont("Arial", "B", 22)
	pdf.SetTextColor(6, 95, 70)
	pdf.CellFormat(0, 10, "SERTIFIKAT PENERIMAAN", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 8, "DAGING QURBAN IDUL ADHA", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Body
	pdf.SetTextColor(60, 60, 60)
	pdf.SetFont("Arial", "", 11)
	pdf.CellFormat(0, 6, "Diberikan kepada:", "", 1, "C", false, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 20)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(0, 10, nama, "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(0, 5, "Kode Tiket: "+kode+"    Kategori: "+kategori, "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Narasi
	pdf.SetFont("Arial", "", 11)
	pdf.SetTextColor(60, 60, 60)
	waktuStr := "-"
	if diambilAt.Valid {
		waktuStr = diambilAt.Time.In(time.FixedZone("WIB", 7*3600)).Format("2 January 2006, 15:04 WIB")
	}
	pdf.SetX(20)
	pdf.MultiCell(170, 6,
		"Panitia Idul Qurban dengan ini menyatakan bahwa penerima di atas telah menerima\n"+
			"daging qurban sebagai bagian dari pelaksanaan ibadah Idul Adha.\n"+
			"Waktu pengambilan: "+waktuStr, "", "C", false)
	pdf.Ln(6)

	// Signature
	petugasNama := "Panitia"
	if petugas.Valid && petugas.String != "" {
		petugasNama = petugas.String
	}
	pdf.SetFont("Arial", "", 10)
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "Hormat kami,", "", 1, "C", false, 0, "")
	pdf.Ln(10)
	pdf.SetX(130)
	pdf.CellFormat(60, 5, "( "+petugasNama+" )", "", 1, "C", false, 0, "")
	pdf.SetX(130)
	pdf.SetFont("Arial", "I", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(60, 4, "Panitia Distribusi", "", 1, "C", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", `inline; filename="sertifikat-`+kode+`.pdf"`)
	return c.Send(buf.Bytes())
}

// PetaPenerima — data ringan khusus untuk peta (hanya yang punya koordinat)
func PetaPenerima(c *fiber.Ctx) error {
	rows, err := database.Pool.Query(context.Background(), `
		SELECT p.id, p.kode, p.nama, COALESCE(p.alamat,''), COALESCE(p.kategori,''),
		       p.latitude, p.longitude,
		       CASE WHEN d.id IS NULL THEN false ELSE true END AS diambil,
		       d.diambil_at
		FROM penerima_daging p
		LEFT JOIN distribusi d ON d.penerima_id = p.id
		WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type item struct {
		ID        string     `json:"id"`
		Kode      string     `json:"kode"`
		Nama      string     `json:"nama"`
		Alamat    string     `json:"alamat"`
		Kategori  string     `json:"kategori"`
		Latitude  float64    `json:"latitude"`
		Longitude float64    `json:"longitude"`
		Diambil   bool       `json:"diambil"`
		DiambilAt *time.Time `json:"diambil_at,omitempty"`
	}
	out := []item{}
	for rows.Next() {
		var it item
		var da sql.NullTime
		if err := rows.Scan(&it.ID, &it.Kode, &it.Nama, &it.Alamat, &it.Kategori,
			&it.Latitude, &it.Longitude, &it.Diambil, &da); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		if da.Valid {
			t := da.Time
			it.DiambilAt = &t
		}
		out = append(out, it)
	}
	return c.JSON(out)
}
