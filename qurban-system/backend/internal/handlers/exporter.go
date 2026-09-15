package handlers

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jung-kurt/gofpdf"
	"github.com/xuri/excelize/v2"

	"qurban-backend/internal/database"
)

// ExportRekapXLSX — laporan rekap peserta + status pembayaran + distribusi
func ExportRekapXLSX(c *fiber.Ctx) error {
	f := excelize.NewFile()
	defer f.Close()

	// Sheet 1: Peserta
	sh := "Peserta"
	f.SetSheetName("Sheet1", sh)
	headers := []string{"Nama", "No HP", "Email", "Paket", "Total Bayar", "Terbayar", "Status"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sh, cell, h)
	}
	rows, _ := database.Pool.Query(context.Background(), `
		SELECT p.nama, COALESCE(p.no_hp,''), COALESCE(p.email,''), COALESCE(ps.nama,'-'),
		       p.total_bayar, p.total_terbayar, p.status_bayar
		FROM peserta p LEFT JOIN paket_sapi ps ON ps.id = p.paket_id
		ORDER BY p.created_at DESC`)
	defer rows.Close()
	r := 2
	for rows.Next() {
		var nama, noHP, email, paket, status string
		var bayar, terbayar float64
		_ = rows.Scan(&nama, &noHP, &email, &paket, &bayar, &terbayar, &status)
		f.SetCellValue(sh, fmt.Sprintf("A%d", r), nama)
		f.SetCellValue(sh, fmt.Sprintf("B%d", r), noHP)
		f.SetCellValue(sh, fmt.Sprintf("C%d", r), email)
		f.SetCellValue(sh, fmt.Sprintf("D%d", r), paket)
		f.SetCellValue(sh, fmt.Sprintf("E%d", r), bayar)
		f.SetCellValue(sh, fmt.Sprintf("F%d", r), terbayar)
		f.SetCellValue(sh, fmt.Sprintf("G%d", r), status)
		r++
	}

	// Sheet 2: Distribusi
	sh2 := "Distribusi"
	idx, _ := f.NewSheet(sh2)
	f.SetActiveSheet(idx)
	dh := []string{"Kode", "Nama Penerima", "Kategori", "Diambil?", "Waktu"}
	for i, h := range dh {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sh2, cell, h)
	}
	drows, _ := database.Pool.Query(context.Background(), `
		SELECT p.kode, p.nama, COALESCE(p.kategori,''), 
		       CASE WHEN d.id IS NULL THEN 'BELUM' ELSE 'SUDAH' END,
		       COALESCE(to_char(d.diambil_at,'YYYY-MM-DD HH24:MI'),'-')
		FROM penerima_daging p LEFT JOIN distribusi d ON d.penerima_id = p.id`)
	defer drows.Close()
	r = 2
	for drows.Next() {
		var kode, nama, kat, status, waktu string
		_ = drows.Scan(&kode, &nama, &kat, &status, &waktu)
		f.SetCellValue(sh2, fmt.Sprintf("A%d", r), kode)
		f.SetCellValue(sh2, fmt.Sprintf("B%d", r), nama)
		f.SetCellValue(sh2, fmt.Sprintf("C%d", r), kat)
		f.SetCellValue(sh2, fmt.Sprintf("D%d", r), status)
		f.SetCellValue(sh2, fmt.Sprintf("E%d", r), waktu)
		r++
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", `attachment; filename="rekap-qurban.xlsx"`)
	return c.Send(buf.Bytes())
}

// ExportRekapPDF — laporan singkat PDF
func ExportRekapPDF(c *fiber.Ctx) error {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 10, "Laporan Rekapitulasi Qurban", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, "Tanggal: "+time.Now().Format("2 January 2006 15:04"), "", 1, "C", false, 0, "")
	pdf.Ln(6)

	// Ringkasan
	var total, taken, pTotal, pLunas int
	var tagihan, terbayar float64
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM penerima_daging`).Scan(&total)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM distribusi`).Scan(&taken)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM peserta`).Scan(&pTotal)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM peserta WHERE status_bayar='lunas'`).Scan(&pLunas)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COALESCE(SUM(total_bayar),0), COALESCE(SUM(total_terbayar),0) FROM peserta`).Scan(&tagihan, &terbayar)

	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 8, "Ringkasan")
	pdf.Ln(8)
	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 6, fmt.Sprintf("Peserta Qurban: %d (Lunas: %d)", pTotal, pLunas))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Penerima Daging: %d (Sudah diambil: %d)", total, taken))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Total Tagihan: Rp %.0f", tagihan))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Total Terbayar: Rp %.0f", terbayar))
	pdf.Ln(10)

	// Daftar Peserta
	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 8, "Daftar Peserta")
	pdf.Ln(8)
	pdf.SetFillColor(230, 230, 230)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(60, 7, "Nama", "1", 0, "L", true, 0, "")
	pdf.CellFormat(50, 7, "Paket", "1", 0, "L", true, 0, "")
	pdf.CellFormat(40, 7, "Tagihan", "1", 0, "R", true, 0, "")
	pdf.CellFormat(40, 7, "Status", "1", 1, "L", true, 0, "")

	rows, _ := database.Pool.Query(context.Background(), `
		SELECT p.nama, COALESCE(ps.nama,'-'), p.total_bayar, p.status_bayar
		FROM peserta p LEFT JOIN paket_sapi ps ON ps.id = p.paket_id LIMIT 30`)
	defer rows.Close()
	pdf.SetFont("Arial", "", 10)
	for rows.Next() {
		var n, pk, st string
		var t float64
		_ = rows.Scan(&n, &pk, &t, &st)
		pdf.CellFormat(60, 6, n, "1", 0, "L", false, 0, "")
		pdf.CellFormat(50, 6, pk, "1", 0, "L", false, 0, "")
		pdf.CellFormat(40, 6, fmt.Sprintf("Rp %.0f", t), "1", 0, "R", false, 0, "")
		pdf.CellFormat(40, 6, st, "1", 1, "L", false, 0, "")
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", `attachment; filename="rekap-qurban.pdf"`)
	return c.Send(buf.Bytes())
}
