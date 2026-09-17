import { useEffect, useState } from 'react'
import { api, wsUrl } from '../services/api'
import Penerima from './Penerima'

export default function Pembagian() {
  const [tab, setTab] = useState('penerima')

  return (
    <div className="space-y-6" data-testid="pembagian-page">
      <div>
        <h1 className="text-2xl font-extrabold">Panitia Pembagian</h1>
        <p className="text-sm text-slate-500">Kelola data penerima daging dan pantau proses pendistribusian.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('penerima')} data-testid="tab-penerima"
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'penerima' ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>Data Penerima</button>
        <button onClick={() => setTab('distribusi')} data-testid="tab-distribusi"
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'distribusi' ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>Monitoring Distribusi</button>
      </div>

      {tab === 'penerima' ? <Penerima /> : <DistribusiTab />}
    </div>
  )
}

function DistribusiTab() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)

  const load = () => {
    api.get('/api/distribusi').then(r => setItems(r.data || []))
    api.get('/api/distribusi/stats').then(r => setStats(r.data))
  }

  useEffect(() => {
    load()
    const ws = new WebSocket(wsUrl())
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.event === 'distribusi.scan') load() } catch {} }
    return () => ws.close()
  }, [])

  const persen = stats && stats.penerima_total
    ? Math.round((stats.penerima_taken / stats.penerima_total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Total Penerima</div>
          <div className="text-3xl font-extrabold mt-1">{stats?.penerima_total ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Sudah Mengambil</div>
          <div className="text-3xl font-extrabold mt-1 text-primary-700">{stats?.penerima_taken ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Belum Mengambil</div>
          <div className="text-3xl font-extrabold mt-1 text-amber-600">
            {stats ? stats.penerima_total - stats.penerima_taken : '-'}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Progres</div>
          <div className="text-3xl font-extrabold mt-1">{persen}%</div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${persen}%` }} />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">Riwayat Pendistribusian</div>
          <span className="badge bg-primary-50 text-primary-700">LIVE</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Waktu</th><th>Penerima</th><th>Petugas</th><th>Catatan</th></tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="py-2 text-xs">{new Date(d.diambil_at).toLocaleString('id-ID')}</td>
                <td className="font-semibold">{d.nama_penerima}</td>
                <td className="text-xs">{d.nama_petugas || '-'}</td>
                <td className="text-xs">{d.catatan || '-'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-500">Belum ada distribusi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
