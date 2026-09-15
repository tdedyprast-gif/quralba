package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fws "github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"

	"qurban-backend/internal/config"
	"qurban-backend/internal/database"
	"qurban-backend/internal/handlers"
	"qurban-backend/internal/middleware"
	"qurban-backend/internal/ws"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	// Init DB
	if err := database.Connect(cfg); err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	if err := database.Migrate(); err != nil {
		log.Fatalf("db migrate failed: %v", err)
	}
	if err := database.SeedAdmin(); err != nil {
		log.Fatalf("db seed failed: %v", err)
	}

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	app := fiber.New(fiber.Config{
		AppName: "Qurban Management API",
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
	}))

	// Health
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Auth
	app.Post("/api/auth/register", handlers.Register)
	app.Post("/api/auth/login", handlers.Login)

	// Public webhook (doit.id callback)
	app.Post("/api/webhook/doit", handlers.DoitWebhook)

	// WebSocket upgrade
	app.Use("/ws", func(c *fiber.Ctx) error {
		if fws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/distribusi", fws.New(ws.DistribusiSocket(hub)))

	// Protected routes
	api := app.Group("/api", middleware.JWTProtected())

	api.Get("/me", handlers.Me)

	// Paket sapi
	api.Get("/paket", handlers.ListPaket)
	api.Post("/paket", handlers.CreatePaket)
	api.Put("/paket/:id", handlers.UpdatePaket)
	api.Delete("/paket/:id", handlers.DeletePaket)

	// Peserta / shohibul qurban
	api.Get("/peserta", handlers.ListPeserta)
	api.Post("/peserta", handlers.CreatePeserta)
	api.Get("/peserta/:id", handlers.GetPeserta)
	api.Put("/peserta/:id", handlers.UpdatePeserta)
	api.Delete("/peserta/:id", handlers.DeletePeserta)

	// Pembayaran (Doit.id)
	api.Post("/peserta/:id/invoice", handlers.CreateInvoice)

	// Penerima daging
	api.Get("/penerima", handlers.ListPenerima)
	api.Post("/penerima", handlers.CreatePenerima)
	api.Get("/penerima/:id/qr", handlers.GetPenerimaQR)

	// Distribusi
	api.Get("/distribusi", handlers.ListDistribusi)
	api.Post("/distribusi/scan", handlers.ScanQR(hub))
	api.Get("/distribusi/stats", handlers.DistribusiStats)

	// Import (Excel)
	api.Post("/import/penerima", handlers.ImportPenerima)
	api.Post("/import/peserta", handlers.ImportPeserta)

	// Export laporan
	api.Get("/export/rekap.xlsx", handlers.ExportRekapXLSX)
	api.Get("/export/rekap.pdf", handlers.ExportRekapPDF)

	// Transaksi log
	api.Get("/transaksi", handlers.ListTransaksi)

	log.Printf("Server running on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
