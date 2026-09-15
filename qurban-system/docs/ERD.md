# ERD — Sistem Pengelolaan Ibadah Idul Qurban

## Diagram Relasi

```
┌─────────────┐        ┌────────────────┐        ┌───────────────────┐
│   users     │        │   paket_sapi   │        │    peserta        │
│ (panitia)   │        │                │        │ (shohibul qurban) │
├─────────────┤        ├────────────────┤        ├───────────────────┤
│ id  PK      │        │ id  PK         │◄───┐   │ id  PK            │
│ email  UQ   │        │ nama           │    │   │ nama              │
│ password_h  │        │ jenis          │    │   │ no_hp, email      │
│ nama, role  │        │ max_shohibul   │    └───│ paket_id  FK      │
└──────┬──────┘        │ harga_per_org  │        │ slot_ke           │
       │               │ deskripsi      │        │ total_bayar       │
       │               └────────────────┘        │ total_terbayar    │
       │                                         │ status_bayar      │
       │                                         │ doit_invoice_id   │
       │                                         │ doit_invoice_url  │
       │                                         └─────────┬─────────┘
       │                                                   │
       │                                                   │ (audit log 1..n)
       │                                                   ▼
       │                                         ┌─────────────────────┐
       │                                         │  transaksi_doit     │
       │                                         │ (webhook audit log) │
       │                                         ├─────────────────────┤
       │                                         │ id  PK              │
       │                                         │ peserta_id  FK      │
       │                                         │ doit_invoice_id     │
       │                                         │ event (paid/…)      │
       │                                         │ status              │
       │                                         │ amount              │
       │                                         │ raw_payload  JSONB  │
       │                                         │ received_at         │
       │                                         └─────────────────────┘
       │
       │  (petugas scan)
       │
       ▼
┌────────────────┐        ┌───────────────────┐
│  distribusi    │  1..1  │ penerima_daging   │
├────────────────┤◄───────┤ (mustahiq)        │
│ id  PK         │        ├───────────────────┤
│ penerima_id FK │        │ id  PK            │
│ petugas_id  FK │        │ kode  UQ          │
│ diambil_at     │        │ nama, alamat      │
│ catatan        │        │ kategori          │
└────────────────┘        │ qr_token  UQ      │
                          └───────────────────┘
```

## Detail Tabel

### users (Panitia)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | `gen_random_uuid()` |
| email | TEXT UNIQUE | login |
| password_hash | TEXT | bcrypt |
| nama | TEXT | nama panitia |
| role | TEXT | `admin` \| `panitia` |
| created_at | TIMESTAMPTZ | |

### paket_sapi
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| nama | TEXT | mis. "Paket Patungan 1/7" |
| jenis | TEXT | `sapi_penuh` \| `patungan_1_7` \| `mandiri` |
| max_shohibul | INT | jumlah orang / sapi (1 utk mandiri, 7 utk patungan) |
| harga_per_orang | NUMERIC(14,2) | |
| deskripsi | TEXT | |

### peserta (Shohibul Qurban)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| nama, no_hp, alamat, email | TEXT | |
| paket_id | UUID FK → paket_sapi | ON DELETE SET NULL |
| slot_ke | INT | urutan slot patungan (1..max_shohibul) |
| total_bayar | NUMERIC | tagihan penuh |
| total_terbayar | NUMERIC | akumulasi cicilan |
| status_bayar | TEXT | `belum_lunas` \| `cicilan` \| `lunas` |
| doit_invoice_id | TEXT | id invoice di Doit.id |
| doit_invoice_url | TEXT | link pembayaran |

### penerima_daging (Mustahiq)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| kode | TEXT UNIQUE | mis. `PN-a1f2` |
| nama, alamat, kategori | TEXT | kategori: fakir / miskin / tetangga / panitia |
| qr_token | TEXT UNIQUE | 16-byte random hex — di-encode ke QR |

### distribusi
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| penerima_id | UUID FK UNIQUE → penerima_daging | 1 penerima hanya bisa ambil sekali |
| petugas_id | UUID FK → users | siapa yang men-scan |
| diambil_at | TIMESTAMPTZ | `default now()` |
| catatan | TEXT | opsional |

### transaksi_doit (Log Webhook)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| peserta_id | UUID FK | nullable (jika webhook tidak match) |
| doit_invoice_id | TEXT | |
| event | TEXT | `invoice.created` \| `invoice.paid` \| `invoice.partial` \| `invoice.expired` |
| status | TEXT | `PAID`/`PARTIAL`/`EXPIRED` |
| amount | NUMERIC | |
| raw_payload | JSONB | full payload untuk audit / replay |
| received_at | TIMESTAMPTZ | |

## Aturan Bisnis Kunci

1. **Patungan 1/7** — peserta dengan `paket.jenis='patungan_1_7'` boleh terkumpul hingga `max_shohibul=7` orang berbeda; setiap orang jadi record `peserta` terpisah dengan `slot_ke` 1..7.
2. **Status pembayaran** otomatis di-update via webhook Doit.id (tidak diinput manual).
3. **QR Token unik** dan tidak dapat ditebak (random hex 16-byte).
4. **Distribusi idempoten**: constraint UNIQUE(`penerima_id`) mencegah double-scan → response 409 di frontend.
5. **Audit trail lengkap** semua callback pembayaran tersimpan raw di `transaksi_doit.raw_payload` (JSONB, bisa di-query dengan `->>`).
