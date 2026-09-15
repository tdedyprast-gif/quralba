import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'

export default function Penerima() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ nama: '', alamat: '', kategori: 'fakir', latitude: '', longitude: '' })
  const [showQR, setShowQR] = useState(null)

  const load = () => api.get('/api/penerima').then(r => setItems(r.data || []))
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      }
      await api.post('/api/penerima', payload)
      toast.success('Ditambahkan')
      setForm({ nama: '', alamat: '', kategori: 'fakir', latitude: '', longitude: '' })
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal') }
  }

  const showQRFor = async (id) => {
    const r = await api.get(`/api/penerima/${id}/qr`); setShowQR(r.data)
  }

  const importFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await api.post('/api/import/penerima', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(`Import ${r.data.inserted} baris`); load()
    } catch (err) { toast.error('Gagal import') }
    e.target.value = ''
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Browser tidak mendukung geolokasi')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }))
        toast.success('Lokasi diambil')
      },
      () => toast.error('Gagal ambil lokasi (izin ditolak?)'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const sertifikatURL = (id) => `${apiBase}/api/penerima/${id}/sertifikat`

  return (
    <div className="space-y-6" data-testid="penerima-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Penerima Daging</h1>
        <label className="btn-outline cursor-pointer">
          📥 Import XLSX
          <input type="file" accept=".xlsx" className="hidden" onChange={importFile} />
        </label>
      </div>

      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2"><label className="label">Nama</label><input required className="input" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="penerima-nama" /></div>
        <div className="md:col-span-2"><label className="label">Alamat</label><input className="input" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} /></div>
        <div><label className="label">Kategori</label>
          <select className="input" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
            <option>fakir</option><option>miskin</option><option>tetangga</option><option>panitia</option>
          </select>
        </div>
        <div>
          <label className="label">Latitude</label>
          <input className="input" type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="-6.2088" />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input className="input" type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="106.8456" />
        </div>
        <button type="button" onClick={useMyLocation} className="btn-outline justify-center" data-testid="penerima-lokasi">📍 Gunakan lokasi saya</button>
        <div></div>
        <button className="btn-primary justify-center" data-testid="penerima-submit">Tambah Penerima</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Kode</th><th>Nama</th><th>Alamat</th><th>Kategori</th><th>Lokasi</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 font-mono">{p.kode}</td>
                <td className="font-semibold">{p.nama}</td>
                <td>{p.alamat}</td>
                <td>{p.kategori}</td>
                <td className="text-xs">
                  {p.latitude != null && p.longitude != null
                    ? <span className="text-slate-500">{Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}</span>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td>{p.diambil ? <span className="badge bg-green-100 text-green-700">Diambil</span> : <span className="badge bg-slate-100 text-slate-600">Belum</span>}</td>
                <td className="text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => showQRFor(p.id)} className="btn-outline text-xs">QR</button>
                  {p.diambil && (
                    <a href={sertifikatURL(p.id)} target="_blank" rel="noreferrer" className="btn-outline text-xs" data-testid={`sertifikat-${p.id}`}>📄 Sertifikat</a>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-500">Belum ada.</td></tr>}
          </tbody>
        </table>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold">{showQR.nama}</div>
            <div className="text-sm text-slate-500 mb-4">{showQR.kode}</div>
            <div className="grid place-items-center">
              <QRCodeCanvas value={showQR.qr_value} size={220} />
            </div>
            <div className="text-xs mt-3 font-mono break-all">{showQR.qr_value}</div>
            <button className="btn-primary mt-4 w-full justify-center" onClick={() => window.print()}>Cetak</button>
          </div>
        </div>
      )}
    </div>
  )
}
