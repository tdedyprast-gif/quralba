import { useEffect, useState } from 'react'
import { api, wsUrl } from '../services/api'
import toast from 'react-hot-toast'

function Stat({ label, value, sub, testid }) {
  return (
    <div className="card" data-testid={testid}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-extrabold mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [live, setLive] = useState([])

  const load = () => api.get('/api/distribusi/stats').then(r => setStats(r.data))

  useEffect(() => {
    load()
    const ws = new WebSocket(wsUrl())
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'distribusi.scan') {
          setLive(prev => [msg.data, ...prev].slice(0, 20))
          toast.success(`Diambil: ${msg.data.nama}`)
          load()
        }
      } catch {}
    }
    return () => ws.close()
  }, [])

  const persen = stats && stats.penerima_total ? Math.round((stats.penerima_taken / stats.penerima_total) * 100) : 0
  const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard Panitia</h1>
        <p className="text-sm text-slate-500">Ringkasan realtime peserta, pembayaran, dan distribusi.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat testid="stat-peserta" label="Total Peserta" value={stats?.peserta_total ?? '-'} sub={`Lunas: ${stats?.peserta_lunas ?? 0}`} />
        <Stat testid="stat-tagihan" label="Total Tagihan" value={rupiah(stats?.total_tagihan)} sub={`Terbayar: ${rupiah(stats?.total_terbayar)}`} />
        <Stat testid="stat-penerima" label="Penerima Daging" value={stats?.penerima_total ?? '-'} sub={`Sudah ambil: ${stats?.penerima_taken ?? 0}`} />
        <Stat testid="stat-progress" label="Progres Distribusi" value={`${persen}%`} sub="Update realtime" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold">Aktivitas Realtime</div>
            <div className="text-xs text-slate-500">Pemindaian QR terbaru (WebSocket)</div>
          </div>
          <span className="badge bg-primary-50 text-primary-700">LIVE</span>
        </div>
        {live.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">Belum ada pemindaian.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {live.map((it, i) => (
              <li key={i} className="py-2 text-sm flex justify-between">
                <span>{it.nama} <span className="text-slate-400">({it.kode})</span></span>
                <span className="text-slate-500">baru saja</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
