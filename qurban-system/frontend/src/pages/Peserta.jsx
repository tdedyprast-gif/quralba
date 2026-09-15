import { useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function Peserta() {
  const [items, setItems] = useState([])
  const [paket, setPaket] = useState([])
  const [form, setForm] = useState({ nama: '', no_hp: '', email: '', alamat: '', paket_id: '' })

  const load = () => api.get('/api/peserta').then(r => setItems(r.data || []))
  useEffect(() => { load(); api.get('/api/paket').then(r => setPaket(r.data || [])) }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, paket_id: form.paket_id || null }
      await api.post('/api/peserta', payload)
      toast.success('Peserta ditambahkan')
      setForm({ nama: '', no_hp: '', email: '', alamat: '', paket_id: '' })
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal') }
  }

  const buatTagihan = async (id) => {
    try {
      const r = await api.post(`/api/peserta/${id}/invoice`, {}, { headers: { 'X-Callback-Base': window.location.origin.replace(':3000', ':8080') } })
      toast.success('Invoice dibuat')
      window.open(r.data.invoice_url, '_blank')
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal') }
  }

  const importFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await api.post('/api/import/peserta', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(`Berhasil import ${r.data.inserted} baris`); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal import') }
    e.target.value = ''
  }

  const badge = (s) => ({
    lunas: 'bg-green-100 text-green-700',
    cicilan: 'bg-amber-100 text-amber-700',
    belum_lunas: 'bg-slate-100 text-slate-700',
  }[s] || 'bg-slate-100 text-slate-700')

  return (
    <div className="space-y-6" data-testid="peserta-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Peserta Qurban (Shohibul)</h1>
        <label className="btn-outline cursor-pointer">
          📥 Import XLSX
          <input type="file" accept=".xlsx" className="hidden" onChange={importFile} data-testid="peserta-import" />
        </label>
      </div>

      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2"><label className="label">Nama</label><input required className="input" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="peserta-nama" /></div>
        <div><label className="label">No. HP</label><input className="input" value={form.no_hp} onChange={e => setForm({ ...form, no_hp: e.target.value })} /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Paket</label>
          <select className="input" value={form.paket_id} onChange={e => setForm({ ...form, paket_id: e.target.value })}>
            <option value="">-- Pilih --</option>
            {paket.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        <button className="btn-primary justify-center" data-testid="peserta-submit">Daftar</button>
        <div className="md:col-span-6"><label className="label">Alamat</label><input className="input" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} /></div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Nama</th><th>Kontak</th><th>Paket</th><th>Tagihan</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 font-semibold">{p.nama}</td>
                <td>{p.no_hp || '-'}<div className="text-xs text-slate-500">{p.email}</div></td>
                <td>{p.paket_nama || '-'}</td>
                <td>Rp {Number(p.total_bayar).toLocaleString('id-ID')}<div className="text-xs text-slate-500">Terbayar: Rp {Number(p.total_terbayar).toLocaleString('id-ID')}</div></td>
                <td><span className={`badge ${badge(p.status_bayar)}`}>{p.status_bayar}</span></td>
                <td className="text-right">
                  {p.doit_invoice_url ? (
                    <a href={p.doit_invoice_url} target="_blank" rel="noreferrer" className="text-primary-700 text-xs font-semibold">Lihat Invoice</a>
                  ) : (
                    <button onClick={() => buatTagihan(p.id)} className="btn-outline text-xs" data-testid={`peserta-invoice-${p.id}`}>Buat Tagihan</button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-500">Belum ada peserta.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
