import { useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function Paket() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ nama: '', jenis: 'sapi_penuh', max_shohibul: 7, harga_per_orang: 3500000, deskripsi: '' })

  const load = () => api.get('/api/paket').then(r => setItems(r.data || []))
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/paket', { ...form, max_shohibul: Number(form.max_shohibul), harga_per_orang: Number(form.harga_per_orang) })
      toast.success('Paket ditambahkan')
      setForm({ nama: '', jenis: 'sapi_penuh', max_shohibul: 7, harga_per_orang: 3500000, deskripsi: '' })
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal') }
  }

  const del = async (id) => {
    if (!confirm('Hapus paket ini?')) return
    await api.delete(`/api/paket/${id}`); load()
  }

  return (
    <div className="space-y-6" data-testid="paket-page">
      <h1 className="text-2xl font-extrabold">Paket Sapi Qurban</h1>
      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2"><label className="label">Nama Paket</label><input required className="input" data-testid="paket-nama" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} /></div>
        <div><label className="label">Jenis</label>
          <select className="input" value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value })}>
            <option value="sapi_penuh">Sapi Penuh (Mandiri)</option>
            <option value="patungan_1_7">Patungan 1/7</option>
            <option value="mandiri">Mandiri Lain</option>
          </select>
        </div>
        <div><label className="label">Max Orang</label><input type="number" className="input" value={form.max_shohibul} onChange={e => setForm({ ...form, max_shohibul: e.target.value })} /></div>
        <div><label className="label">Harga/orang</label><input type="number" className="input" value={form.harga_per_orang} onChange={e => setForm({ ...form, harga_per_orang: e.target.value })} /></div>
        <div className="md:col-span-4"><label className="label">Deskripsi</label><input className="input" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} /></div>
        <button className="btn-primary justify-center" data-testid="paket-submit">Tambah</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Nama</th><th>Jenis</th><th>Max</th><th>Harga</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 font-semibold">{p.nama}</td>
                <td>{p.jenis}</td>
                <td>{p.max_shohibul}</td>
                <td>Rp {Number(p.harga_per_orang).toLocaleString('id-ID')}</td>
                <td className="text-right"><button onClick={() => del(p.id)} className="text-red-600 text-xs" data-testid={`paket-del-${p.id}`}>Hapus</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-500">Belum ada paket.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
