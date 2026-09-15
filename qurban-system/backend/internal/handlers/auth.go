package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/database"
	"qurban-backend/internal/utils"
)

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nama     string `json:"nama"`
}

func Register(c *fiber.Ctx) error {
	var r registerReq
	if err := c.BodyParser(&r); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if r.Email == "" || r.Password == "" || r.Nama == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email, password, nama wajib"})
	}
	hash, err := utils.HashPassword(r.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	var id string
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, nama, role) VALUES ($1,$2,$3,'panitia') RETURNING id`,
		r.Email, hash, r.Nama).Scan(&id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	tok, _ := utils.GenerateJWT(id, r.Email, "panitia")
	return c.JSON(fiber.Map{"token": tok, "user": fiber.Map{"id": id, "email": r.Email, "nama": r.Nama, "role": "panitia"}})
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
	var id, hash, nama, role string
	err := database.Pool.QueryRow(context.Background(),
		`SELECT id, password_hash, nama, role FROM users WHERE email=$1`, r.Email).
		Scan(&id, &hash, &nama, &role)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "email/password salah"})
	}
	if !utils.CheckPassword(hash, r.Password) {
		return c.Status(401).JSON(fiber.Map{"error": "email/password salah"})
	}
	tok, _ := utils.GenerateJWT(id, r.Email, role)
	return c.JSON(fiber.Map{"token": tok, "user": fiber.Map{"id": id, "email": r.Email, "nama": nama, "role": role}})
}

func Me(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"id":    c.Locals("uid"),
		"email": c.Locals("email"),
		"role":  c.Locals("role"),
	})
}
