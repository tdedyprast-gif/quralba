package handlers

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// Konfigurasi upload gambar paket
const (
	maxImageSize = 5 << 20 // 5 MB
	uploadRoot   = "./uploads"
)

var allowedImageExt = map[string]bool{".jpg": true, ".jpeg": true, ".png": true}

// isImageBytes — validasi isi file lewat magic bytes, bukan hanya ekstensi.
func isImageBytes(b []byte) bool {
	if len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF {
		return true // JPEG
	}
	pngSig := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	if len(b) >= 8 && bytes.Equal(b[:8], pngSig) {
		return true // PNG
	}
	return false
}

// UploadPaketImage — unggah gambar paket (jpg/jpeg/png).
// File disimpan di folder publik ./uploads/paket/ dan dikembalikan sebagai URL
// relatif (/uploads/paket/xxx.jpg) agar bisa diakses lewat Nginx.
func UploadPaketImage(c *fiber.Ctx) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "field 'file' wajib (jpg/jpeg/png)"})
	}
	if fh.Size <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "file kosong"})
	}
	if fh.Size > maxImageSize {
		return c.Status(400).JSON(fiber.Map{"error": "ukuran gambar maksimal 5 MB"})
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !allowedImageExt[ext] {
		return c.Status(400).JSON(fiber.Map{"error": "format gambar harus jpg, jpeg, atau png"})
	}

	// Verifikasi isi file benar-benar gambar
	f, err := fh.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "gagal membaca file"})
	}
	head := make([]byte, 8)
	n, _ := io.ReadFull(f, head)
	_ = f.Close()
	if !isImageBytes(head[:n]) {
		return c.Status(400).JSON(fiber.Map{"error": "isi file bukan gambar jpg/png yang valid"})
	}

	dir := filepath.Join(uploadRoot, "paket")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "gagal menyiapkan folder upload: " + err.Error()})
	}

	filename := fmt.Sprintf("paket-%s%s", rndHex(12), ext)
	dst := filepath.Join(dir, filename)
	if err := c.SaveFile(fh, dst); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "gagal menyimpan file: " + err.Error()})
	}

	url := "/uploads/paket/" + filename
	return c.Status(201).JSON(fiber.Map{
		"ok":       true,
		"url":      url,
		"filename": filename,
		"size":     fh.Size,
	})
}
