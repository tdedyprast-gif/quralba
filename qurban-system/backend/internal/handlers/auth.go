package handlers

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/utils"
)

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nama     string `json:"nama"`
	NoHP     string `json:"no_hp"`
	Alamat   string `json:"alamat"`
	Role     string `json:"role"` // 'peserta' | 'penerima'
	PaketID  string `json:"paket_id"`
}

// Register — pendaftaran mandiri untuk calon peserta (shohibul) atau penerima daging.
// Akun dibuat dengan status 'pending' dan harus divalidasi admin sebelum bisa login.
func Register(c *fiber.Ctx) error {
	var r registerReq
	if err := c.BodyParser(&r); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	r.Email = strings.TrimSpace(strings.ToLower(r.Email))
	r.Role = strings.TrimSpace(strings.ToLower(r.Role))
	r.Nama = strings.TrimSpace(r.Nama)

	if r.Email == "" || r.Password == "" || r.Nama == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email, password, dan nama wajib diisi"})
	}
	if len(r.Password) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "password minimal 6 karakter"})
	}
	if r.Role != "peserta" && r.Role != "penerima" {
		return c.Status(400).JSON(fiber.Map{"error": "role harus 'peserta' atau 'penerima'"})
	}

	hash, err := utils.HashPassword(r.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var paketID *string
	if r.Role == "peserta" && r.PaketID != "" {
		paketID = &r.PaketID
	}

	var id string
	err = database.Pool.QueryRow(context.Background(), `
		INSERT INTO users (email, password_hash, nama, role, status, no_hp, alamat, paket_id)
		VALUES ($1,$2,$3,$4,'pending',$5,$6,$7) RETURNING id`,
		r.Email, hash, r.Nama, r.Role, r.NoHP, r.Alamat, paketID).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			return c.Status(409).JSON(fiber.Map{"error": "email sudah terdaftar"})
		}
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{
		"ok":      true,
		"id":      id,
		"status":  "pending",
		"message": "Pendaftaran berhasil. Akun Anda menunggu validasi panitia admin.",
	})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c *fiber.Ctx) error {
	var r loginReq
	if err := c.BodyParser(&r); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	r.Email = strings.TrimSpace(strings.ToLower(r.Email))

	var id, hash, nama, role, status, rejectReason string
	err := database.Pool.QueryRow(context.Background(),
		`SELECT id, password_hash, nama, role, COALESCE(status,'active'), COALESCE(reject_reason,'')
		 FROM users WHERE email=$1`, r.Email).
		Scan(&id, &hash, &nama, &role, &status, &rejectReason)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "email/password salah"})
	}
	if !utils.CheckPassword(hash, r.Password) {
		return c.Status(401).JSON(fiber.Map{"error": "email/password salah"})
	}

	switch status {
	case "pending":
		return c.Status(403).JSON(fiber.Map{
			"error":  "Akun Anda belum divalidasi. Menunggu persetujuan panitia admin.",
			"status": "pending",
		})
	case "rejected":
		msg := "Pendaftaran Anda ditolak oleh admin."
		if rejectReason != "" {
			msg += " Alasan: " + rejectReason
		}
		return c.Status(403).JSON(fiber.Map{"error": msg, "status": "rejected"})
	}

	tok, _ := utils.GenerateJWT(id, r.Email, role)
	return c.JSON(fiber.Map{"token": tok, "user": fiber.Map{
		"id": id, "email": r.Email, "nama": nama, "role": role, "status": status,
	}})
}

func Me(c *fiber.Ctx) error {
	uid, _ := c.Locals("uid").(string)
	var u struct {
		ID         string
		Email      string
		Nama       string
		Role       string
		Status     string
		NoHP       string
		Alamat     string
		PesertaID  *string
		PenerimaID *string
	}
	err := database.Pool.QueryRow(context.Background(), `
		SELECT id, email, nama, role, COALESCE(status,'active'), COALESCE(no_hp,''), COALESCE(alamat,''),
		       peserta_id, penerima_id
		FROM users WHERE id=$1`, uid).
		Scan(&u.ID, &u.Email, &u.Nama, &u.Role, &u.Status, &u.NoHP, &u.Alamat, &u.PesertaID, &u.PenerimaID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user tidak ditemukan"})
	}
	return c.JSON(fiber.Map{
		"id": u.ID, "email": u.Email, "nama": u.Nama, "role": u.Role, "status": u.Status,
		"no_hp": u.NoHP, "alamat": u.Alamat,
		"peserta_id": u.PesertaID, "penerima_id": u.PenerimaID,
	})
}
