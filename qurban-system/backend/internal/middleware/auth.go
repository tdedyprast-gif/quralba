package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"qurban-backend/internal/utils"
)

func JWTProtected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		h := c.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"error": "missing token"})
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		claims, err := utils.ParseJWT(tokenStr)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid token"})
		}
		c.Locals("uid", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}
