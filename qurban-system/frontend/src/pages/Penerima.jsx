import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'

const KATEGORI = ['fakir', 'miskin', 'tetangga', 'panitia', 'penerima']
const emptyForm = { nama: '', alamat: '', kategori: 'fakir', no_hp: '', latitude: '', longitude: '' }

export default function Penerima() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [showQR, setShowQR] = useState(null)
  const [search, setSearch] = useState('')

  const load = () => api.get('/api/penerima').then(r => setItems(r.data || []))
  useEffect(() => { load() }, [])

  const reset = () => { setForm(emptyForm); setEditing(null) }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      }
      if (editing) {
        await api.put(`/api/penerima/${editing}`, payload)
        toast.success('Data penerima diperbarui')
      } else {
        await api.post('/api/penerima', payload)
        toast.success('Penerima ditambahkan')
      }
      reset(); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menyimpan') }
  }

  const edit = (p) => {
    setEditing(p.id)
    setForm({
      nama: p.nama, alamat: p.alamat || '', kategori: p.kategori || 'fakir',
      no_hp: p.no_hp || '',
      latitude: p.latitude ?? '', longitude: p.longitude ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hapus = async (p) => {
    if (!confirm(`Hapus penerima "${p.nama}"? Riwayat distribusinya ikut terhapus.`)) return
    try { await api.delete(`/api/penerima/${p.id}`); toast.success('Dihapus'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Gagal menghapus') }
  }

  const showQRFor = async (id) => {
    const r = await api.get(`/api/penerima/${id}/qr`); setShowQR(r.data)
  }

  const importFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await api.post('/api/import/penerima', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const d = r.data
      toast.success(`Import selesai — ${d.inserted} masuk, ${d.skipped || 0} dilewati, ${d.failed || 0} gagal`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal import') }
    e.target.value = ''
  }

  const downloadTemplate = async () => {
    try {
      const r = await api.get('/api/import/template/penerima', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'template-import-penerima.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Template diunduh')
    } catch (err) { toast.error('Gagal mengunduh template') }
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

  const apiBase = import.meta.env.VITE_API_URL ?? ''
  const sertifikatURL = (id) => `${apiBase}/api/penerima/${id}/sertifikat`

  const filtered = items.filter(p =>
    !search || p.nama.toLowerCase().includes(search.toLowerCase()) || (p.kode || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6" data-testid="penerima-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Data Penerima Daging</h1>
          <p className="text-sm text-slate-500">Kelola data penerima, cetak QR, dan import massal dari Excel.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-outline" data-testid="penerima-template">
            📄 Template Excel
          </button>
          <label className="btn-outline cursor-pointer">
            📥 Import XLSX
            <input type="file" accept=".xlsx" className="hidden" onChange={importFile} data-testid="penerima-import" />
          </label>
        </div>
      </div>

      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end" data-testid="penerima-form">
        <div className="md:col-span-2">
          <label className="label">Nama *</label>
          <input required className="input" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="penerima-nama" />
        </div>
        <div>
          <label className="label">Kategori</label>
          <select className="input" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
            {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="label">No. HP</label>
          <input className="input" value={form.no_hp} onChange={e => setForm({ ...form, no_hp: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Alamat</label>
          <input className="input" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} />
        </div>
        <div>
          <label className="label">Latitude</label>
          <input className="input" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="-6.917464" />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input className="input" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="107.619123" />
        </div>
        <button type="button" onClick={useMyLocation} className="btn-outline justify-center">📍 Lokasi saya</button>
        <button className="btn-primary justify-center" data-testid="penerima-submit">{editing ? 'Perbarui' : 'Tambah'}</button>
        {editing && <button type="button" onClick={reset} className="btn-outline justify-center">Batal</button>}
      </form>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="font-bold">Daftar Penerima <span className="text-slate-400 font-normal">({filtered.length})</span></div>
          <input className="input max-w-xs" placeholder="Cari nama / kode…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Kode</th><th>Nama</th><th>Kategori</th><th>Kontak</th><th>Alamat</th><th>Status</th><th className="text-right">Aksi</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 text-xs font-mono">{p.kode}</td>
                <td className="font-semibold">{p.nama}</td>
                <td><span className="badge bg-slate-100 text-slate-700">{p.kategori || '-'}</span></td>
                <td className="text-xs">{p.no_hp || '-'}</td>
                <td className="text-xs max-w-[220px]">{p.alamat || '-'}</td>
                <td>
                  {p.diambil
                    ? <span className="badge bg-green-100 text-green-700">Sudah ambil</span>
                    : <span className="badge bg-amber-100 text-amber-700">Belum</span>}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => showQRFor(p.id)} className="text-primary-700 text-xs font-semibold" data-testid={`qr-${p.id}`}>QR</button>
                  {p.diambil && (
                    <a href={sertifikatURL(p.id)} target="_blank" rel="noreferrer" className="text-primary-700 text-xs font-semibold ml-3">Sertifikat</a>
                  )}
                  <button onClick={() => edit(p)} className="text-slate-600 text-xs font-semibold ml-3">Edit</button>
                  <button onClick={() => hapus(p)} className="text-red-600 text-xs font-semibold ml-3">Hapus</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-500">Belum ada penerima.</td></tr>}
          </tbody>
        </table>
      </div>

      {showQR && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50" onClick={() => setShowQR(null)}>
          <div className="card text-center" onClick={e => e.stopPropagation()} data-testid="qr-modal">
            <div className="font-bold">{showQR.nama}</div>
            <div className="text-xs text-slate-500 mb-3">{showQR.kode}</div>
            <div className="bg-white p-3 inline-block rounded-lg">
              <QRCodeCanvas value={showQR.qr_value} size={200} />
            </div>
            <div className="text-xs text-slate-400 mt-3 break-all max-w-[240px]">{showQR.qr_value}</div>
            <button onClick={() => setShowQR(null)} className="btn-outline w-full mt-4 justify-center">Tutup</button>
          </div>
        </div>
      )}
    </div>
  )
}
