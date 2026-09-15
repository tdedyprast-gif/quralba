package config

import "os"

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	DoitAPIKey   string
	DoitBaseURL  string
	DoitWebhookSecret string
	AdminEmail   string
	AdminPass    string
}

func Load() *Config {
	return &Config{
		Port:              getenv("PORT", "8080"),
		DatabaseURL:       getenv("DATABASE_URL", "postgres://qurban:qurban@localhost:5432/qurban?sslmode=disable"),
		JWTSecret:         getenv("JWT_SECRET", "change-me-super-secret"),
		DoitAPIKey:        getenv("DOIT_API_KEY", "SANDBOX_KEY_REPLACE_ME"),
		DoitBaseURL:       getenv("DOIT_BASE_URL", "https://api.doit.id/v1"),
		DoitWebhookSecret: getenv("DOIT_WEBHOOK_SECRET", "SANDBOX_WEBHOOK_SECRET"),
		AdminEmail:        getenv("ADMIN_EMAIL", "admin@qurban.local"),
		AdminPass:         getenv("ADMIN_PASS", "admin123"),
	}
}

var current *Config

func Get() *Config {
	if current == nil {
		current = Load()
	}
	return current
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
