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

	// File publik (gambar paket) — disajikan langsung dari folder ./uploads
	app.Static("/uploads", "./uploads")

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
	// Catatan: guard role dipasang PER-ROUTE, bukan lewat Group("", mw).
	// Group("") mendaftarkan middleware Use("/api") yang berlaku lintas route
	// dan urutannya bergantung urutan registrasi — mudah bocor antar role.
	api := app.Group("/api", middleware.JWTProtected())

	api.Get("/me", handlers.Me)
	api.Get("/saya", handlers.Saya) // self-service untuk semua role

	// ── Self-service peserta: pilih / daftar paket qurban sendiri ──
	pesertaOnly := middleware.RequireRole("peserta")
	api.Get("/saya/paket", pesertaOnly, handlers.PaketSaya)
	api.Post("/saya/paket", pesertaOnly, handlers.PilihPaketSaya)

	// ── Admin: validasi & kelola akun ──
	adminOnly := middleware.RequireRole("admin")
	api.Get("/admin/users", adminOnly, handlers.ListUsers)
	api.Post("/admin/users", adminOnly, handlers.CreateUser)
	api.Put("/admin/users/:id", adminOnly, handlers.UpdateUser)
	api.Get("/admin/stats", adminOnly, handlers.AdminStats)
	api.Post("/admin/users/:id/approve", adminOnly, handlers.ApproveUser)
	api.Post("/admin/users/:id/reject", adminOnly, handlers.RejectUser)

	// ── Panitia bendahara: paket + peserta + pencatatan pembayaran ──
	kasir := middleware.RequireRole("admin", "bendahara")

	// Paket sapi
	api.Get("/paket", kasir, handlers.ListPaket)
	api.Post("/paket", kasir, handlers.CreatePaket)
	api.Put("/paket/:id", kasir, handlers.UpdatePaket)
	api.Delete("/paket/:id", kasir, handlers.DeletePaket)

	// Upload gambar paket (folder publik ./uploads/paket)
	api.Post("/upload/paket", kasir, handlers.UploadPaketImage)

	// Peserta / shohibul qurban
	api.Get("/peserta", kasir, handlers.ListPeserta)
	api.Post("/peserta", kasir, handlers.CreatePeserta)
	api.Get("/peserta/:id", kasir, handlers.GetPeserta)
	api.Put("/peserta/:id", kasir, handlers.UpdatePeserta)
	api.Delete("/peserta/:id", kasir, handlers.DeletePeserta)

	// Pembayaran (manual oleh bendahara)
	api.Get("/pembayaran", kasir, handlers.ListPembayaran)
	api.Post("/pembayaran", kasir, handlers.CreatePembayaran)
	api.Delete("/pembayaran/:id", kasir, handlers.DeletePembayaran)
	api.Get("/pembayaran/rekap", kasir, handlers.RekapPembayaran)

	// Invoice online (Doit.id)
	api.Post("/peserta/:id/invoice", kasir, handlers.CreateInvoice)
	api.Get("/transaksi", kasir, handlers.ListTransaksi)

	// ── Panitia pembagian: data penerima + distribusi ──
	dist := middleware.RequireRole("admin", "pembagian")

	api.Get("/penerima", dist, handlers.ListPenerima)
	api.Post("/penerima", dist, handlers.CreatePenerima)
	api.Put("/penerima/:id", dist, handlers.UpdatePenerima)
	api.Delete("/penerima/:id", dist, handlers.DeletePenerima)
	api.Get("/penerima/:id/qr", dist, handlers.GetPenerimaQR)
	api.Get("/penerima/:id/sertifikat", dist, handlers.SertifikatPenerima)
	api.Get("/peta/penerima", dist, handlers.PetaPenerima)

	api.Get("/distribusi", dist, handlers.ListDistribusi)
	api.Post("/distribusi/scan", dist, handlers.ScanQR(hub))
	api.Get("/distribusi/stats", dist, handlers.DistribusiStats)

	// Import (Excel) + template
	api.Post("/import/penerima", dist, handlers.ImportPenerima)
	api.Get("/import/template/penerima", dist, handlers.DownloadTemplatePenerima)
	api.Post("/import/peserta", dist, handlers.ImportPeserta)

	// Export laporan
	api.Get("/export/rekap.xlsx", dist, handlers.ExportRekapXLSX)
	api.Get("/export/rekap.pdf", dist, handlers.ExportRekapPDF)

	log.Printf("Server running on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
