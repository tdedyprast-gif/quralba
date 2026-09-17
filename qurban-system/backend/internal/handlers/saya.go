package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
)

// Saya — data self-service untuk akun yang login.
// - role 'peserta'  → data shohibul + riwayat pembayaran
// - role 'penerima' → data penerima + status pengambilan + QR
// - role panitia    → profil singkat
func Saya(c *fiber.Ctx) error {
	uid, _ := c.Locals("uid").(string)
	role, _ := c.Locals("role").(string)
	ctx := context.Background()

	var id, email, nama, status, noHP, alamat string
	var pesertaID, penerimaID *string
	err := database.Pool.QueryRow(ctx, `
		SELECT id, email, nama, COALESCE(status,'active'), COALESCE(no_hp,''), COALESCE(alamat,''),
		       peserta_id, penerima_id
		FROM users WHERE id=$1`, uid).
		Scan(&id, &email, &nama, &status, &noHP, &alamat, &pesertaID, &penerimaID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}

	out := fiber.Map{
		"id": id, "email": email, "nama": nama, "role": role, "status": status,
		"no_hp": noHP, "alamat": alamat,
	}

	switch role {
	case "peserta":
		if pesertaID != nil {
			var p fiber.Map = fiber.Map{}
			var namaP, noHPP, alamatP, emailP, statusBayar string
			var totalBayar, totalTerbayar float64
			var paketNama *string
			err := database.Pool.QueryRow(ctx, `
				SELECT p.nama, COALESCE(p.no_hp,''), COALESCE(p.alamat,''), COALESCE(p.email,''),
				       p.total_bayar, p.total_terbayar, p.status_bayar, ps.nama
				FROM peserta p LEFT JOIN paket_sapi ps ON ps.id = p.paket_id
				WHERE p.id=$1`, *pesertaID).
				Scan(&namaP, &noHPP, &alamatP, &emailP, &totalBayar, &totalTerbayar, &statusBayar, &paketNama)
			if err == nil {
				p = fiber.Map{
					"id": *pesertaID, "nama": namaP, "no_hp": noHPP, "alamat": alamatP, "email": emailP,
					"total_bayar": totalBayar, "total_terbayar": totalTerbayar,
					"status_bayar": statusBayar, "paket_nama": paketNama,
				}
				// riwayat pembayaran
				rows, err := database.Pool.Query(ctx, `
					SELECT id, amount, metode, COALESCE(referensi,''), COALESCE(catatan,''), paid_at
					FROM pembayaran WHERE peserta_id=$1 ORDER BY paid_at DESC`, *pesertaID)
				riwayat := []fiber.Map{}
				if err == nil {
					defer rows.Close()
					for rows.Next() {
						var pid, metode, referensi, catatan string
						var amount float64
						var paidAt interface{}
						if err := rows.Scan(&pid, &amount, &metode, &referensi, &catatan, &paidAt); err == nil {
							riwayat = append(riwayat, fiber.Map{
								"id": pid, "amount": amount, "metode": metode,
								"referensi": referensi, "catatan": catatan, "paid_at": paidAt,
							})
						}
					}
				}
				p["riwayat_pembayaran"] = riwayat
			}
			out["peserta"] = p
		}

	case "penerima":
		if penerimaID != nil {
			var kode, namaP, alamatP, kategori, qrToken, noHPP string
			var lat, lng *float64
			err := database.Pool.QueryRow(ctx, `
				SELECT kode, nama, COALESCE(alamat,''), COALESCE(kategori,''), qr_token,
				       COALESCE(no_hp,''), latitude, longitude
				FROM penerima_daging WHERE id=$1`, *penerimaID).
				Scan(&kode, &namaP, &alamatP, &kategori, &qrToken, &noHPP, &lat, &lng)
			if err == nil {
				var diambil bool
				var diambilAt interface{}
				_ = database.Pool.QueryRow(ctx,
					`SELECT true, diambil_at FROM distribusi WHERE penerima_id=$1`, *penerimaID).
					Scan(&diambil, &diambilAt)
				out["penerima"] = fiber.Map{
					"id": *penerimaID, "kode": kode, "nama": namaP, "alamat": alamatP,
					"kategori": kategori, "no_hp": noHPP, "latitude": lat, "longitude": lng,
					"qr_value": "QURBAN|" + kode + "|" + qrToken,
					"diambil":  diambil, "diambil_at": diambilAt,
				}
			}
		}
	}

	return c.JSON(out)
}
