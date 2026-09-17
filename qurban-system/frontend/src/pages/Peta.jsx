import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, wsUrl } from '../services/api'

// Fix default icon paths for Leaflet in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CENTER_JAKARTA = [-6.2088, 106.8456]

export default function Peta() {
  const [items, setItems] = useState([])

  const load = () => api.get('/api/peta/penerima').then(r => setItems(r.data || []))

  useEffect(() => {
    load()
    const ws = new WebSocket(wsUrl())
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.event === 'distribusi.scan') load() } catch {} }
    return () => ws.close()
  }, [])

  const center = useMemo(() => {
    if (items.length === 0) return CENTER_JAKARTA
    const lat = items.reduce((s, i) => s + i.latitude, 0) / items.length
    const lng = items.reduce((s, i) => s + i.longitude, 0) / items.length
    return [lat, lng]
  }, [items])

  const sudah = items.filter(i => i.diambil).length
  const belum = items.length - sudah

  return (
    <div className="space-y-4" data-testid="peta-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Peta Distribusi</h1>
          <p className="text-sm text-slate-500">Sebaran penerima daging qurban — update realtime saat panitia scan QR.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Sudah ambil: <b>{sudah}</b></span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Belum: <b>{belum}</b></span>
        </div>
      </div>

      {items.length === 0 && (
        <div className="card text-sm text-slate-500">
          Belum ada penerima dengan koordinat. Buka halaman <b>Penerima</b> dan tambahkan lokasi (klik "Gunakan lokasi saya" atau isi lat/lng manual).
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <MapContainer center={center} zoom={items.length > 0 ? 13 : 11} style={{ height: '65vh', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {items.map(it => (
            <CircleMarker
              key={it.id}
              center={[it.latitude, it.longitude]}
              radius={10}
              pathOptions={{
                color: it.diambil ? '#059669' : '#f59e0b',
                fillColor: it.diambil ? '#10b981' : '#fbbf24',
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold">{it.nama}</div>
                  <div className="text-slate-500">{it.kode} · {it.kategori}</div>
                  <div className="mt-1">{it.alamat}</div>
                  <div className="mt-2">
                    {it.diambil ? (
                      <span className="font-semibold text-emerald-700">✓ Sudah diambil</span>
                    ) : (
                      <span className="font-semibold text-amber-700">◷ Belum diambil</span>
                    )}
                  </div>
                  {it.diambil && (
                    <a
                      href={`${import.meta.env.VITE_API_URL ?? ''}/api/penerima/${it.id}/sertifikat`}
                      target="_blank" rel="noreferrer"
                      className="inline-block mt-2 text-primary-700 font-semibold"
                    >📄 Unduh Sertifikat</a>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
