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

CREATE TABLE IF NOT EXISTS paket_sapi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    jenis TEXT NOT NULL, -- 'sapi_penuh', 'patungan_1_7', 'mandiri'
    max_shohibul INT NOT NULL DEFAULT 1,
    harga_per_orang NUMERIC(14,2) NOT NULL,
    deskripsi TEXT,
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
    created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_peserta_paket ON peserta(paket_id);
CREATE INDEX IF NOT EXISTS idx_trx_peserta ON transaksi_doit(peserta_id);
`
