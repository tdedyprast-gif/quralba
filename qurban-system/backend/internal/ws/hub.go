package ws

import (
	"encoding/json"
	"log"
	"sync"

	fws "github.com/gofiber/websocket/v2"
)

type Hub struct {
	clients    map[*fws.Conn]bool
	broadcast  chan []byte
	register   chan *fws.Conn
	unregister chan *fws.Conn
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*fws.Conn]bool),
		broadcast:  make(chan []byte, 64),
		register:   make(chan *fws.Conn),
		unregister: make(chan *fws.Conn),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()
		case c := <-h.unregister:
			h.mu.Lock()
			delete(h.clients, c)
			h.mu.Unlock()
		case msg := <-h.broadcast:
			h.mu.RLock()
			for c := range h.clients {
				if err := c.WriteMessage(fws.TextMessage, msg); err != nil {
					log.Println("ws write:", err)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast a JSON payload as event to all subscribers.
func (h *Hub) BroadcastJSON(event string, data any) {
	payload, err := json.Marshal(map[string]any{"event": event, "data": data})
	if err != nil {
		return
	}
	h.broadcast <- payload
}

// DistribusiSocket returns a fiber websocket handler.
func DistribusiSocket(hub *Hub) func(c *fws.Conn) {
	return func(c *fws.Conn) {
		hub.register <- c
		defer func() {
			hub.unregister <- c
			_ = c.Close()
		}()
		// Send hello
		_ = c.WriteMessage(fws.TextMessage, []byte(`{"event":"hello","data":"connected"}`))
		// Read loop (ignore messages; just keep-alive)
		for {
			if _, _, err := c.ReadMessage(); err != nil {
				return
			}
		}
	}
}
