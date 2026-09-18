# -------- build stage --------
FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd

# -------- runtime stage --------
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/server /app/server
# Folder publik untuk gambar paket (dipasang sebagai volume di compose)
RUN mkdir -p /app/uploads/paket
EXPOSE 8080
CMD ["/app/server"]
