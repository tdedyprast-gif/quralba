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

// RequireRole membatasi akses hanya untuk role tertentu.
// Harus dipakai setelah JWTProtected().
func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals("role").(string)
		if !allowed[role] {
			return c.Status(403).JSON(fiber.Map{"error": "akses ditolak untuk role " + role})
		}
		return c.Next()
	}
}
