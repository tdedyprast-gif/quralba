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

	// Auth (public)
	app.Post("/api/auth/register", handlers.Register)
	app.Post("/api/auth/login", handlers.Login)

	// Info publik (untuk halaman pendaftaran)
	app.Get("/api/public/paket", handlers.ListPaket)

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

	// ── Protected (butuh login) ──
	api := app.Group("/api", middleware.JWTProtected())

	api.Get("/me", handlers.Me)
	api.Get("/saya", handlers.Saya) // self-service untuk semua role

	// ── Admin: validasi & kelola akun ──
	admin := api.Group("/admin", middleware.RequireRole("admin"))
	admin.Get("/users", handlers.ListUsers)
	admin.Post("/users", handlers.CreateUser)
	admin.Put("/users/:id", handlers.UpdateUser)
	admin.Get("/stats", handlers.AdminStats)
	admin.Post("/users/:id/approve", handlers.ApproveUser)
	admin.Post("/users/:id/reject", handlers.RejectUser)

	// ── Panitia bendahara: paket + pencatatan pembayaran ──
	bendahara := api.Group("", middleware.RequireRole("admin", "bendahara"))

	// Paket sapi
	bendahara.Get("/paket", handlers.ListPaket)
	bendahara.Post("/paket", handlers.CreatePaket)
	bendahara.Put("/paket/:id", handlers.UpdatePaket)
	bendahara.Delete("/paket/:id", handlers.DeletePaket)

	// Peserta / shohibul qurban
	bendahara.Get("/peserta", handlers.ListPeserta)
	bendahara.Post("/peserta", handlers.CreatePeserta)
	bendahara.Get("/peserta/:id", handlers.GetPeserta)
	bendahara.Put("/peserta/:id", handlers.UpdatePeserta)
	bendahara.Delete("/peserta/:id", handlers.DeletePeserta)

	// Pembayaran (manual oleh bendahara)
	bendahara.Get("/pembayaran", handlers.ListPembayaran)
	bendahara.Post("/pembayaran", handlers.CreatePembayaran)
	bendahara.Delete("/pembayaran/:id", handlers.DeletePembayaran)
	bendahara.Get("/pembayaran/rekap", handlers.RekapPembayaran)

	// Invoice online (Doit.id)
	bendahara.Post("/peserta/:id/invoice", handlers.CreateInvoice)
	bendahara.Get("/transaksi", handlers.ListTransaksi)

	// ── Panitia pembagian: data penerima + distribusi ──
	pembagian := api.Group("", middleware.RequireRole("admin", "pembagian"))

	pembagian.Get("/penerima", handlers.ListPenerima)
	pembagian.Post("/penerima", handlers.CreatePenerima)
	pembagian.Put("/penerima/:id", handlers.UpdatePenerima)
	pembagian.Delete("/penerima/:id", handlers.DeletePenerima)
	pembagian.Get("/penerima/:id/qr", handlers.GetPenerimaQR)
	pembagian.Get("/penerima/:id/sertifikat", handlers.SertifikatPenerima)
	pembagian.Get("/peta/penerima", handlers.PetaPenerima)

	pembagian.Get("/distribusi", handlers.ListDistribusi)
	pembagian.Post("/distribusi/scan", handlers.ScanQR(hub))
	pembagian.Get("/distribusi/stats", handlers.DistribusiStats)

	// Import (Excel) + template
	pembagian.Post("/import/penerima", handlers.ImportPenerima)
	pembagian.Get("/import/template/penerima", handlers.DownloadTemplatePenerima)
	pembagian.Post("/import/peserta", handlers.ImportPeserta)

	// Export laporan
	pembagian.Get("/export/rekap.xlsx", handlers.ExportRekapXLSX)
	pembagian.Get("/export/rekap.pdf", handlers.ExportRekapPDF)

	log.Printf("Server running on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
