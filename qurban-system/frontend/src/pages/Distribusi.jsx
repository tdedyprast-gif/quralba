import { useEffect, useState } from 'react'
import { api, wsUrl } from '../services/api'

export default function Distribusi() {
  const [items, setItems] = useState([])
  const load = () => api.get('/api/distribusi').then(r => setItems(r.data || []))
  useEffect(() => {
    load()
    const ws = new WebSocket(wsUrl())
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.event === 'distribusi.scan') load() } catch {} }
    return () => ws.close()
  }, [])

  return (
    <div className="space-y-6" data-testid="distribusi-page">
      <h1 className="text-2xl font-extrabold">Riwayat Distribusi</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left"><tr><th className="py-2">Waktu</th><th>Penerima</th><th>Petugas</th><th>Catatan</th></tr></thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="py-2">{new Date(d.diambil_at).toLocaleString('id-ID')}</td>
                <td className="font-semibold">{d.nama_penerima}</td>
                <td>{d.nama_petugas || '-'}</td>
                <td>{d.catatan || '-'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-500">Belum ada distribusi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
