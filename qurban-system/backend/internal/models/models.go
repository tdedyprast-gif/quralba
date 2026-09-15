package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Nama         string    `json:"nama"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type PaketSapi struct {
	ID            string    `json:"id"`
	Nama          string    `json:"nama"`
	Jenis         string    `json:"jenis"`
	MaxShohibul   int       `json:"max_shohibul"`
	HargaPerOrang float64   `json:"harga_per_orang"`
	Deskripsi     string    `json:"deskripsi"`
	CreatedAt     time.Time `json:"created_at"`
}

type Peserta struct {
	ID             string     `json:"id"`
	Nama           string     `json:"nama"`
	NoHP           string     `json:"no_hp"`
	Alamat         string     `json:"alamat"`
	Email          string     `json:"email"`
	PaketID        *string    `json:"paket_id"`
	SlotKe         int        `json:"slot_ke"`
	TotalBayar     float64    `json:"total_bayar"`
	TotalTerbayar  float64    `json:"total_terbayar"`
	StatusBayar    string     `json:"status_bayar"`
	DoitInvoiceID  *string    `json:"doit_invoice_id"`
	DoitInvoiceURL *string    `json:"doit_invoice_url"`
	CreatedAt      time.Time  `json:"created_at"`
	PaketNama      *string    `json:"paket_nama,omitempty"`
}

type PenerimaDaging struct {
	ID        string    `json:"id"`
	Kode      string    `json:"kode"`
	Nama      string    `json:"nama"`
	Alamat    string    `json:"alamat"`
	Kategori  string    `json:"kategori"`
	QRToken   string    `json:"qr_token"`
	Latitude  *float64  `json:"latitude"`
	Longitude *float64  `json:"longitude"`
	CreatedAt time.Time `json:"created_at"`
	Diambil   bool      `json:"diambil"`
}

type Distribusi struct {
	ID          string    `json:"id"`
	PenerimaID  string    `json:"penerima_id"`
	DiambilAt   time.Time `json:"diambil_at"`
	PetugasID   *string   `json:"petugas_id"`
	Catatan     string    `json:"catatan"`
	NamaPenerima string   `json:"nama_penerima,omitempty"`
	NamaPetugas  string   `json:"nama_petugas,omitempty"`
}

type TransaksiDoit struct {
	ID            string    `json:"id"`
	PesertaID     *string   `json:"peserta_id"`
	DoitInvoiceID string    `json:"doit_invoice_id"`
	Event         string    `json:"event"`
	Status        string    `json:"status"`
	Amount        float64   `json:"amount"`
	RawPayload    string    `json:"raw_payload"`
	ReceivedAt    time.Time `json:"received_at"`
}
