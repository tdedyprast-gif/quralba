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
			var paketID *string
			err := database.Pool.QueryRow(ctx, `
				SELECT p.nama, COALESCE(p.no_hp,''), COALESCE(p.alamat,''), COALESCE(p.email,''),
				       p.total_bayar, p.total_terbayar, p.status_bayar, ps.nama, p.paket_id
				FROM peserta p LEFT JOIN paket_sapi ps ON ps.id = p.paket_id
				WHERE p.id=$1`, *pesertaID).
				Scan(&namaP, &noHPP, &alamatP, &emailP, &totalBayar, &totalTerbayar, &statusBayar, &paketNama, &paketID)
			if err == nil {
				p = fiber.Map{
					"id": *pesertaID, "nama": namaP, "no_hp": noHPP, "alamat": alamatP, "email": emailP,
					"total_bayar": totalBayar, "total_terbayar": totalTerbayar,
					"status_bayar": statusBayar, "paket_nama": paketNama, "paket_id": paketID,
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

// ─────────────────────── Self-service pendaftaran paket ───────────────────────
//
// Dipakai oleh role 'peserta' yang sudah login untuk memilih / mengganti paket
// qurban-nya sendiri tanpa harus menghubungi panitia.

// pesertaIDFromUser — ambil id record `peserta` yang tertaut ke akun user.
// Mengembalikan "" kalau akun belum tertaut (mis. belum divalidasi admin).
func pesertaIDFromUser(ctx context.Context, uid string) (string, error) {
	var pesertaID *string
	err := database.Pool.QueryRow(ctx,
		`SELECT peserta_id FROM users WHERE id=$1`, uid).Scan(&pesertaID)
	if err != nil {
		return "", err
	}
	if pesertaID == nil || *pesertaID == "" {
		return "", nil
	}
	return *pesertaID, nil
}

// PaketSaya — daftar paket qurban yang bisa dipilih + paket yang sedang dipakai.
// GET /api/saya/paket  (role: peserta)
func PaketSaya(c *fiber.Ctx) error {
	if role, _ := c.Locals("role").(string); role != "peserta" {
		return c.Status(403).JSON(fiber.Map{"error": "hanya peserta qurban yang bisa mendaftar paket"})
	}
	uid, _ := c.Locals("uid").(string)
	ctx := context.Background()

	pesertaID, err := pesertaIDFromUser(ctx, uid)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}
	if pesertaID == "" {
		return c.Status(404).JSON(fiber.Map{
			"error": "data peserta belum tertaut ke akun ini — hubungi panitia admin",
		})
	}

	var paketAktif *string
	_ = database.Pool.QueryRow(ctx,
		`SELECT paket_id FROM peserta WHERE id=$1`, pesertaID).Scan(&paketAktif)

	rows, err := database.Pool.Query(ctx, `
		SELECT pk.id, pk.nama, pk.jenis, pk.max_shohibul, pk.harga_per_orang,
		       COALESCE(pk.deskripsi,''), COALESCE(pk.gambar,''),
		       (SELECT COUNT(*) FROM peserta p WHERE p.paket_id = pk.id) AS terisi
		FROM paket_sapi pk
		ORDER BY pk.harga_per_orang ASC, pk.created_at DESC`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	list := []fiber.Map{}
	for rows.Next() {
		var id, nama, jenis, deskripsi, gambar string
		var maxShohibul, terisi int
		var harga float64
		if err := rows.Scan(&id, &nama, &jenis, &maxShohibul, &harga,
			&deskripsi, &gambar, &terisi); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		// sisa kuota tidak menghitung diri sendiri kalau sudah pakai paket ini
		sisa := maxShohibul - terisi
		if paketAktif != nil && *paketAktif == id {
			sisa = maxShohibul - terisi + 1
		}
		list = append(list, fiber.Map{
			"id": id, "nama": nama, "jenis": jenis,
			"max_shohibul": maxShohibul, "harga_per_orang": harga,
			"deskripsi": deskripsi, "gambar": gambar,
			"terisi": terisi, "sisa": sisa,
			"penuh": sisa <= 0,
			"dipakai": paketAktif != nil && *paketAktif == id,
		})
	}

	return c.JSON(fiber.Map{
		"peserta_id": pesertaID,
		"paket_id":   paketAktif,
		"paket":      list,
	})
}

// PilihPaketSaya — peserta mendaftar / mengganti paket qurban.
// POST /api/saya/paket  body: {"paket_id":"..."}  (role: peserta)
func PilihPaketSaya(c *fiber.Ctx) error {
	if role, _ := c.Locals("role").(string); role != "peserta" {
		return c.Status(403).JSON(fiber.Map{"error": "hanya peserta qurban yang bisa mendaftar paket"})
	}
	uid, _ := c.Locals("uid").(string)
	ctx := context.Background()

	var req struct {
		PaketID string `json:"paket_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.PaketID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "paket_id wajib diisi"})
	}

	pesertaID, err := pesertaIDFromUser(ctx, uid)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}
	if pesertaID == "" {
		return c.Status(404).JSON(fiber.Map{
			"error": "data peserta belum tertaut ke akun ini — hubungi panitia admin",
		})
	}

	// harga + kuota paket tujuan
	var harga float64
	var maxShohibul int
	var namaPaket string
	err = database.Pool.QueryRow(ctx,
		`SELECT harga_per_orang, max_shohibul, nama FROM paket_sapi WHERE id=$1`, req.PaketID).
		Scan(&harga, &maxShohibul, &namaPaket)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "paket tidak ditemukan"})
	}

	// kuota: hitung peserta lain saja (diri sendiri tidak dihitung ganda)
	var terisi int
	_ = database.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM peserta WHERE paket_id=$1 AND id<>$2`, req.PaketID, pesertaID).Scan(&terisi)
	if terisi >= maxShohibul {
		return c.Status(409).JSON(fiber.Map{"error": "kuota paket sudah penuh, silakan pilih paket lain"})
	}

	if _, err := database.Pool.Exec(ctx,
		`UPDATE peserta SET paket_id=$1, total_bayar=$2 WHERE id=$3`,
		req.PaketID, harga, pesertaID); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	// hitung ulang status pembayaran terhadap tagihan baru
	_ = recalcPeserta(ctx, pesertaID)

	var statusBayar string
	var totalTerbayar float64
	_ = database.Pool.QueryRow(ctx,
		`SELECT status_bayar, total_terbayar FROM peserta WHERE id=$1`, pesertaID).
		Scan(&statusBayar, &totalTerbayar)

	return c.JSON(fiber.Map{
		"ok":             true,
		"peserta_id":     pesertaID,
		"paket_id":       req.PaketID,
		"paket_nama":     namaPaket,
		"total_bayar":    harga,
		"total_terbayar": totalTerbayar,
		"status_bayar":   statusBayar,
	})
}
