package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/utils"
)

func adminRndHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Role yang valid di sistem.
//   admin     → Super User (akses penuh + validasi akun)
//   bendahara → panitia bendahara (paket + pembayaran)
//   pembagian → panitia distribusi/pembagian (penerima + distribusi)
//   peserta   → shohibul qurban (self-service)
//   penerima  → penerima daging (self-service)
var allowedRoles = map[string]bool{
	"admin":     true,
	"bendahara": true,
	"pembagian": true,
	"peserta":   true,
	"penerima":  true,
}

var allowedStatus = map[string]bool{"pending": true, "active": true, "rejected": true}

// paketHargaKuota — ambil harga paket sekaligus cek apakah kuotanya masih tersedia.
// excludePesertaID dipakai saat mengevaluasi ulang peserta yang sudah memakai paket itu
// (agar tidak menghitung dirinya sendiri sebagai pengisi slot).
//
// CATATAN: kolom peserta.id bertipe uuid — jangan pernah membandingkannya dengan string
// kosong (''), karena Postgres gagal cast dan query error (kuota jadi selalu dianggap
// tersedia). Karena itu query-nya dipisah, bukan pakai `id <> $2` dengan $2 = ''.
func paketHargaKuota(ctx context.Context, paketID, excludePesertaID string) (float64, bool) {
	var harga float64
	var maxShohibul int
	if err := database.Pool.QueryRow(ctx,
		`SELECT harga_per_orang, max_shohibul FROM paket_sapi WHERE id=$1`, paketID).
		Scan(&harga, &maxShohibul); err != nil {
		return 0, false
	}

	var terisi int
	var err error
	if excludePesertaID == "" {
		err = database.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM peserta WHERE paket_id=$1`, paketID).Scan(&terisi)
	} else {
		err = database.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM peserta WHERE paket_id=$1 AND id<>$2`, paketID, excludePesertaID).Scan(&terisi)
	}
	if err != nil {
		// gagal menghitung → jangan pakai paket ini (fail closed, jangan sampai over kuota)
		return 0, false
	}
	return harga, terisi < maxShohibul
}

// ensurePesertaRecord — pastikan akun punya record peserta, lalu kembalikan id-nya.
// Urutan: pakai tautan yang ada → pakai record dengan email sama yang belum tertaut → buat baru.
//
// Nilai balik kedua (paketPenuh) = true HANYA kalau paket dari pendaftaran tidak jadi
// dipakai karena kuotanya sudah penuh. Pemanggil sebaiknya memberi tahu admin, dan
// peserta tetap bisa memilih paket lain sendiri lewat menu "Akun Saya".
func ensurePesertaRecord(ctx context.Context, userID, nama, noHP, alamat, email string, paketID *string) (string, bool, error) {
	var linked *string
	_ = database.Pool.QueryRow(ctx, `SELECT peserta_id FROM users WHERE id=$1`, userID).Scan(&linked)
	if linked != nil && *linked != "" {
		return *linked, false, nil
	}

	// Ada record peserta lama dengan email sama yang belum tertaut ke akun mana pun
	// (mis. dibuat manual panitia atau hasil import) → pakai record itu.
	if email != "" {
		var pid string
		var existingPaket *string
		err := database.Pool.QueryRow(ctx, `
			SELECT p.id, p.paket_id FROM peserta p
			LEFT JOIN users u ON u.peserta_id = p.id
			WHERE p.email=$1 AND u.id IS NULL LIMIT 1`, email).Scan(&pid, &existingPaket)
		if err == nil {
			// Record lama belum punya paket → lengkapi dengan paket yang dipilih saat mendaftar.
			if existingPaket == nil && paketID != nil && *paketID != "" {
				harga, tersedia := paketHargaKuota(ctx, *paketID, pid)
				if !tersedia {
					return pid, true, nil
				}
				if _, err := database.Pool.Exec(ctx,
					`UPDATE peserta SET paket_id=$1, total_bayar=$2 WHERE id=$3`,
					*paketID, harga, pid); err != nil {
					return pid, false, nil
				}
				_ = recalcPeserta(ctx, pid)
			}
			return pid, false, nil
		}
	}

	// Buat record baru — paket hanya dipakai kalau kuotanya masih ada.
	var paketFinal *string
	var harga float64
	paketPenuh := false
	if paketID != nil && *paketID != "" {
		if h, tersedia := paketHargaKuota(ctx, *paketID, ""); tersedia {
			paketFinal, harga = paketID, h
		} else {
			paketPenuh = true
		}
	}

	var pesertaID string
	err := database.Pool.QueryRow(ctx, `
		INSERT INTO peserta (nama, no_hp, alamat, email, paket_id, slot_ke, total_bayar, total_terbayar, status_bayar)
		VALUES ($1,$2,$3,$4,$5,1,$6,0,'belum_lunas') RETURNING id`,
		nama, noHP, alamat, email, paketFinal, harga).Scan(&pesertaID)
	if err != nil {
		return "", false, err
	}
	return pesertaID, paketPenuh, nil
}

// ensurePenerimaRecord — pastikan akun punya record penerima_daging.
func ensurePenerimaRecord(ctx context.Context, userID, nama, noHP, alamat string) (string, error) {
	var linked *string
	_ = database.Pool.QueryRow(ctx, `SELECT penerima_id FROM users WHERE id=$1`, userID).Scan(&linked)
	if linked != nil && *linked != "" {
		return *linked, nil
	}
	if noHP != "" {
		var prid string
		err := database.Pool.QueryRow(ctx, `
			SELECT p.id FROM penerima_daging p
			LEFT JOIN users u ON u.penerima_id = p.id
			WHERE p.no_hp=$1 AND u.id IS NULL LIMIT 1`, noHP).Scan(&prid)
		if err == nil {
			return prid, nil
		}
	}
	kode := fmt.Sprintf("PN-%s", adminRndHex(3))
	var penerimaID string
	err := database.Pool.QueryRow(ctx, `
		INSERT INTO penerima_daging (kode, nama, alamat, kategori, no_hp, qr_token)
		VALUES ($1,$2,$3,'penerima',$4,$5) RETURNING id`,
		kode, nama, alamat, noHP, adminRndHex(16)).Scan(&penerimaID)
	if err != nil {
		return "", err
	}
	return penerimaID, nil
}

// ListUsers — daftar akun untuk validasi admin.
// Query: ?status=pending|active|rejected  (kosong = semua)
func ListUsers(c *fiber.Ctx) error {
	status := strings.TrimSpace(c.Query("status"))
	role := strings.TrimSpace(c.Query("role"))

	q := `SELECT id, email, nama, role, COALESCE(status,'active'), COALESCE(no_hp,''),
	             COALESCE(alamat,''), paket_id, COALESCE(reject_reason,''), created_at,
	             peserta_id, penerima_id
	      FROM users WHERE 1=1`
	args := []interface{}{}
	if status != "" {
		args = append(args, status)
		q += fmt.Sprintf(" AND status=$%d", len(args))
	}
	if role != "" {
		args = append(args, role)
		q += fmt.Sprintf(" AND role=$%d", len(args))
	}
	q += " ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END, created_at DESC"

	rows, err := database.Pool.Query(context.Background(), q, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var id, email, nama, r, st, noHP, alamat, rejectReason string
		var paketID, pesertaID, penerimaID *string
		var createdAt interface{}
		if err := rows.Scan(&id, &email, &nama, &r, &st, &noHP, &alamat, &paketID, &rejectReason, &createdAt,
			&pesertaID, &penerimaID); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out = append(out, fiber.Map{
			"id": id, "email": email, "nama": nama, "role": r, "status": st,
			"no_hp": noHP, "alamat": alamat, "paket_id": paketID,
			"reject_reason": rejectReason, "created_at": createdAt,
			"peserta_id": pesertaID, "penerima_id": penerimaID,
		})
	}
	return c.JSON(out)
}

// ApproveUser — validasi akun oleh admin. Sekaligus membuat record
// peserta / penerima_daging sesuai role, lalu menautkannya ke akun.
func ApproveUser(c *fiber.Ctx) error {
	id := c.Params("id")
	adminID, _ := c.Locals("uid").(string)

	var role, nama, noHP, alamat, email, status string
	var paketID *string
	err := database.Pool.QueryRow(context.Background(), `
		SELECT role, nama, COALESCE(no_hp,''), COALESCE(alamat,''), email, COALESCE(status,'active'), paket_id
		FROM users WHERE id=$1`, id).
		Scan(&role, &nama, &noHP, &alamat, &email, &status, &paketID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}
	if status == "active" {
		return c.Status(400).JSON(fiber.Map{"error": "akun sudah aktif"})
	}

	ctx := context.Background()

	switch role {
	case "peserta":
		pesertaID, paketPenuh, err := ensurePesertaRecord(ctx, id, nama, noHP, alamat, email, paketID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "gagal membuat data peserta: " + err.Error()})
		}
		_, _ = database.Pool.Exec(ctx, `
			UPDATE users SET status='active', peserta_id=$1, approved_by=$2, approved_at=now(), reject_reason=NULL
			WHERE id=$3`, pesertaID, adminID, id)
		out := fiber.Map{"ok": true, "status": "active", "peserta_id": pesertaID}
		if paketPenuh {
			out["paket_penuh"] = true
			out["peringatan"] = "Kuota paket yang dipilih sudah penuh — paket belum ditetapkan. Peserta dapat memilih paket lain dari menu Akun Saya."
		}
		return c.JSON(out)

	case "penerima":
		penerimaID, err := ensurePenerimaRecord(ctx, id, nama, noHP, alamat)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "gagal membuat data penerima: " + err.Error()})
		}
		_, _ = database.Pool.Exec(ctx, `
			UPDATE users SET status='active', penerima_id=$1, approved_by=$2, approved_at=now(), reject_reason=NULL
			WHERE id=$3`, penerimaID, adminID, id)
		return c.JSON(fiber.Map{"ok": true, "status": "active", "penerima_id": penerimaID})

	default:
		// role panitia (admin/bendahara/pembagian) cukup diaktifkan
		_, err = database.Pool.Exec(ctx, `
			UPDATE users SET status='active', approved_by=$1, approved_at=now(), reject_reason=NULL
			WHERE id=$2`, adminID, id)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"ok": true, "status": "active"})
	}
}

type createUserReq struct {
	Nama     string `json:"nama"`
	Email    string `json:"email"`
	Password string `json:"password"`
	NoHP     string `json:"no_hp"`
	Alamat   string `json:"alamat"`
	Role     string `json:"role"`
	Status   string `json:"status"`
}

// CreateUser — admin membuat akun langsung (terutama untuk panitia:
// admin/bendahara/pembagian, yang tidak bisa mendaftar sendiri).
func CreateUser(c *fiber.Ctx) error {
	var r createUserReq
	if err := c.BodyParser(&r); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	r.Nama = strings.TrimSpace(r.Nama)
	r.Email = strings.TrimSpace(strings.ToLower(r.Email))
	r.Role = strings.TrimSpace(strings.ToLower(r.Role))
	r.Status = strings.TrimSpace(strings.ToLower(r.Status))

	if r.Nama == "" || r.Email == "" || r.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nama, email, dan password wajib diisi"})
	}
	if len(r.Password) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "password minimal 6 karakter"})
	}
	if !allowedRoles[r.Role] {
		return c.Status(400).JSON(fiber.Map{"error": "role tidak valid"})
	}
	if r.Status == "" {
		r.Status = "active"
	}
	if !allowedStatus[r.Status] {
		return c.Status(400).JSON(fiber.Map{"error": "status harus pending/active/rejected"})
	}

	hash, err := utils.HashPassword(r.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	ctx := context.Background()
	var id string
	err = database.Pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, nama, role, status, no_hp, alamat)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		r.Email, hash, r.Nama, r.Role, r.Status, r.NoHP, r.Alamat).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			return c.Status(409).JSON(fiber.Map{"error": "email sudah terdaftar"})
		}
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	// Siapkan record bila role-nya peserta/penerima dan akun langsung aktif.
	out := fiber.Map{"ok": true, "id": id, "role": r.Role, "status": r.Status}
	if r.Status == "active" {
		switch r.Role {
		case "peserta":
			if pesertaID, _, err := ensurePesertaRecord(ctx, id, r.Nama, r.NoHP, r.Alamat, r.Email, nil); err == nil {
				_, _ = database.Pool.Exec(ctx, `UPDATE users SET peserta_id=$1 WHERE id=$2`, pesertaID, id)
				out["peserta_id"] = pesertaID
			}
		case "penerima":
			if penerimaID, err := ensurePenerimaRecord(ctx, id, r.Nama, r.NoHP, r.Alamat); err == nil {
				_, _ = database.Pool.Exec(ctx, `UPDATE users SET penerima_id=$1 WHERE id=$2`, penerimaID, id)
				out["penerima_id"] = penerimaID
			}
		}
	}
	return c.Status(201).JSON(out)
}

type updateUserReq struct {
	Nama   string `json:"nama"`
	Email  string `json:"email"`
	NoHP   string `json:"no_hp"`
	Alamat string `json:"alamat"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

// UpdateUser — admin mengubah data akun: nama, email, kontak, alamat, role, dan status.
// Perubahan role otomatis menyiapkan/menautkan record peserta atau penerima bila perlu.
func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	adminID, _ := c.Locals("uid").(string)

	var r updateUserReq
	if err := c.BodyParser(&r); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	r.Nama = strings.TrimSpace(r.Nama)
	r.Email = strings.TrimSpace(strings.ToLower(r.Email))
	r.Role = strings.TrimSpace(strings.ToLower(r.Role))
	r.Status = strings.TrimSpace(strings.ToLower(r.Status))

	if r.Nama == "" || r.Email == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nama dan email wajib diisi"})
	}
	if !allowedRoles[r.Role] {
		return c.Status(400).JSON(fiber.Map{"error": "role tidak valid"})
	}
	if r.Status == "" {
		r.Status = "active"
	}
	if !allowedStatus[r.Status] {
		return c.Status(400).JSON(fiber.Map{"error": "status harus pending/active/rejected"})
	}
	// Cegah admin mengunci dirinya sendiri keluar dari role admin.
	if id == adminID && r.Role != "admin" {
		return c.Status(400).JSON(fiber.Map{"error": "tidak dapat mengubah role akun Anda sendiri"})
	}

	ctx := context.Background()

	var paketID *string
	err := database.Pool.QueryRow(ctx, `SELECT paket_id FROM users WHERE id=$1`, id).Scan(&paketID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}

	_, err = database.Pool.Exec(ctx, `
		UPDATE users SET nama=$1, email=$2, no_hp=$3, alamat=$4, role=$5, status=$6
		WHERE id=$7`, r.Nama, r.Email, r.NoHP, r.Alamat, r.Role, r.Status, id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			return c.Status(409).JSON(fiber.Map{"error": "email sudah dipakai akun lain"})
		}
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	out := fiber.Map{"ok": true, "role": r.Role, "status": r.Status}

	switch r.Role {
	case "peserta":
		pesertaID, paketPenuh, err := ensurePesertaRecord(ctx, id, r.Nama, r.NoHP, r.Alamat, r.Email, paketID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "gagal menyiapkan data peserta: " + err.Error()})
		}
		_, _ = database.Pool.Exec(ctx, `UPDATE users SET peserta_id=$1, penerima_id=NULL WHERE id=$2`, pesertaID, id)
		_, _ = database.Pool.Exec(ctx, `
			UPDATE peserta SET nama=$1, no_hp=$2, alamat=$3, email=$4 WHERE id=$5`,
			r.Nama, r.NoHP, r.Alamat, r.Email, pesertaID)
		out["peserta_id"] = pesertaID
		if paketPenuh {
			out["paket_penuh"] = true
			out["peringatan"] = "Kuota paket yang dipilih sudah penuh — paket belum ditetapkan. Peserta dapat memilih paket lain dari menu Akun Saya."
		}

	case "penerima":
		penerimaID, err := ensurePenerimaRecord(ctx, id, r.Nama, r.NoHP, r.Alamat)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "gagal menyiapkan data penerima: " + err.Error()})
		}
		_, _ = database.Pool.Exec(ctx, `UPDATE users SET penerima_id=$1, peserta_id=NULL WHERE id=$2`, penerimaID, id)
		_, _ = database.Pool.Exec(ctx, `
			UPDATE penerima_daging SET nama=$1, no_hp=$2, alamat=$3 WHERE id=$4`,
			r.Nama, r.NoHP, r.Alamat, penerimaID)
		out["penerima_id"] = penerimaID

	default:
		// Role panitia: lepas tautan record (data peserta/penerima tetap tersimpan).
		_, _ = database.Pool.Exec(ctx, `UPDATE users SET peserta_id=NULL, penerima_id=NULL WHERE id=$1`, id)
	}

	return c.JSON(out)
}

type rejectReq struct {
	Reason string `json:"reason"`
}

// RejectUser — tolak pendaftaran dengan alasan.
func RejectUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var r rejectReq
	_ = c.BodyParser(&r)

	res, err := database.Pool.Exec(context.Background(), `
		UPDATE users SET status='rejected', reject_reason=$1, approved_by=$2, approved_at=now()
		WHERE id=$3`, r.Reason, c.Locals("uid"), id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if res.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}
	return c.JSON(fiber.Map{"ok": true, "status": "rejected"})
}

// AdminStats — ringkasan jumlah akun per status & role untuk dashboard validasi.
func AdminStats(c *fiber.Ctx) error {
	stats := fiber.Map{}
	var pending, active, rejected int
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users WHERE status='pending'`).Scan(&pending)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users WHERE status='active'`).Scan(&active)
	_ = database.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users WHERE status='rejected'`).Scan(&rejected)
	stats["pending"] = pending
	stats["active"] = active
	stats["rejected"] = rejected

	rows, _ := database.Pool.Query(context.Background(),
		`SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role`)
	byRole := fiber.Map{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var role string
			var n int
			if err := rows.Scan(&role, &n); err == nil {
				byRole[role] = n
			}
		}
	}
	stats["by_role"] = byRole
	return c.JSON(stats)
}
