package database

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"qurban-backend/internal/config"
	"qurban-backend/internal/utils"
)

var Pool *pgxpool.Pool

func Connect(cfg *config.Config) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	if err := pool.Ping(ctx); err != nil {
		return err
	}
	Pool = pool
	log.Println("Connected to PostgreSQL")
	return nil
}

func Migrate() error {
	ctx := context.Background()
	_, err := Pool.Exec(ctx, schemaSQL)
	return err
}

func SeedAdmin() error {
	cfg := config.Get()
	ctx := context.Background()

	var count int
	if err := Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := utils.HashPassword(cfg.AdminPass)
	if err != nil {
		return err
	}
	_, err = Pool.Exec(ctx,
		`INSERT INTO users (email, password_hash, nama, role) VALUES ($1,$2,$3,'admin')`,
		cfg.AdminEmail, hash, "Admin Panitia")
	if err == nil {
		log.Printf("Seeded admin user: %s", cfg.AdminEmail)
	}
	return err
}

const schemaSQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'panitia',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Kolom tambahan untuk registrasi mandiri + validasi admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS no_hp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paket_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS peserta_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS penerima_id UUID;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS paket_sapi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    jenis TEXT NOT NULL, -- 'sapi_penuh', 'patungan_1_7', 'mandiri'
    max_shohibul INT NOT NULL DEFAULT 1,
    harga_per_orang NUMERIC(14,2) NOT NULL,
    deskripsi TEXT,
    gambar TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    no_hp TEXT,
    alamat TEXT,
    email TEXT,
    paket_id UUID REFERENCES paket_sapi(id) ON DELETE SET NULL,
    slot_ke INT DEFAULT 1,
    total_bayar NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_terbayar NUMERIC(14,2) NOT NULL DEFAULT 0,
    status_bayar TEXT NOT NULL DEFAULT 'belum_lunas', -- 'belum_lunas', 'cicilan', 'lunas'
    doit_invoice_id TEXT,
    doit_invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS penerima_daging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    alamat TEXT,
    kategori TEXT, -- 'fakir', 'miskin', 'tetangga', 'panitia'
    qr_token TEXT UNIQUE NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Idempotent add for existing DBs
ALTER TABLE penerima_daging ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE penerima_daging ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE penerima_daging ADD COLUMN IF NOT EXISTS no_hp TEXT;

CREATE TABLE IF NOT EXISTS distribusi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penerima_id UUID NOT NULL REFERENCES penerima_daging(id) ON DELETE CASCADE,
    diambil_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    petugas_id UUID REFERENCES users(id),
    catatan TEXT,
    UNIQUE(penerima_id)
);

CREATE TABLE IF NOT EXISTS transaksi_doit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peserta_id UUID REFERENCES peserta(id) ON DELETE SET NULL,
    doit_invoice_id TEXT,
    event TEXT, -- 'invoice.created','invoice.paid','invoice.partial','invoice.expired'
    status TEXT,
    amount NUMERIC(14,2),
    raw_payload JSONB,
    received_at TIMESTAMPTZ DEFAULT now()
);

-- Pencatatan pembayaran manual oleh panitia bendahara
CREATE TABLE IF NOT EXISTS pembayaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peserta_id UUID NOT NULL REFERENCES peserta(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    metode TEXT NOT NULL DEFAULT 'tunai', -- 'tunai','transfer','qris','doit'
    referensi TEXT,
    catatan TEXT,
    petugas_id UUID REFERENCES users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peserta_paket ON peserta(paket_id);
CREATE INDEX IF NOT EXISTS idx_trx_peserta ON transaksi_doit(peserta_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_peserta ON pembayaran(peserta_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_paid_at ON pembayaran(paid_at);
`
