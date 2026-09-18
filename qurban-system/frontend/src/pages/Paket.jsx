import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const emptyForm = {
  nama: '', jenis: 'sapi_penuh', max_shohibul: 7,
  harga_per_orang: 3500000, deskripsi: '', gambar: '',
}

export default function Paket() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const formRef = useRef(null)
  const namaRef = useRef(null)

  const load = () => api.get('/api/paket').then(r => setItems(r.data || []))
  useEffect(() => { load() }, [])

  const reset = () => { setForm(emptyForm); setEditing(null); if (fileRef.current) fileRef.current.value = '' }

  // Tombol "+ Tambah Paket Baru" — bersihkan form lalu fokuskan
  const tambahBaru = () => {
    reset()
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => namaRef.current?.focus(), 300)
  }

  const sisa = (p) => Math.max(0, Number(p.max_shohibul || 0) - Number(p.terisi || 0))

  const submit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      max_shohibul: Number(form.max_shohibul),
      harga_per_orang: Number(form.harga_per_orang),
    }
    try {
      if (editing) await api.put(`/api/paket/${editing}`, payload)
      else await api.post('/api/paket', payload)
      toast.success(editing ? 'Paket diperbarui' : 'Paket ditambahkan')
      reset(); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menyimpan') }
  }

  const edit = (p) => {
    setEditing(p.id)
    setForm({
      nama: p.nama, jenis: p.jenis, max_shohibul: p.max_shohibul,
      harga_per_orang: p.harga_per_orang, deskripsi: p.deskripsi || '',
      gambar: p.gambar || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (p) => {
    if (!confirm(`Hapus paket "${p.nama}"?`)) return
    try { await api.delete(`/api/paket/${p.id}`); toast.success('Paket dihapus'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Gagal menghapus') }
  }

  // Upload gambar ke folder publik (jpg/jpeg/png)
  const uploadImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      toast.error('Format gambar harus jpg, jpeg, atau png')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5 MB')
      e.target.value = ''
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const r = await api.post('/api/upload/paket', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setForm(f => ({ ...f, gambar: r.data.url }))
      toast.success('Gambar berhasil diunggah')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengunggah gambar')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6" data-testid="paket-page">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Paket Sapi Qurban</h1>
          <p className="text-sm text-slate-500">
            Tambah paket qurban yang bisa dipilih pendaftar, beserta gambarnya. Gambar disimpan di folder publik
            (<span className="font-mono text-xs">/uploads/paket/</span>) dan tampil di halaman beranda.
          </p>
        </div>
        <button type="button" onClick={tambahBaru} className="btn-primary" data-testid="paket-tambah-baru">
          + Tambah Paket Baru
        </button>
      </div>

      <form ref={formRef} onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end" data-testid="paket-form">
        <div className="md:col-span-2">
          <label className="label">Nama Paket *</label>
          <input required ref={namaRef} className="input" data-testid="paket-nama" value={form.nama}
            onChange={e => setForm({ ...form, nama: e.target.value })} />
        </div>
        <div>
          <label className="label">Jenis</label>
          <select className="input" value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value })}>
            <option value="sapi_penuh">Sapi Penuh (Mandiri)</option>
            <option value="patungan_1_7">Patungan 1/7</option>
            <option value="mandiri">Mandiri Lain</option>
          </select>
        </div>
        <div>
          <label className="label">Max Shohibul</label>
          <input type="number" min="1" className="input" value={form.max_shohibul}
            onChange={e => setForm({ ...form, max_shohibul: e.target.value })} />
        </div>
        <div>
          <label className="label">Harga / Orang *</label>
          <input required type="number" min="0" className="input" value={form.harga_per_orang}
            onChange={e => setForm({ ...form, harga_per_orang: e.target.value })} data-testid="paket-harga" />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center" data-testid="paket-submit">
            {editing ? 'Perbarui' : 'Tambah'}
          </button>
          {editing && <button type="button" onClick={reset} className="btn-outline">Batal</button>}
        </div>

        <div className="md:col-span-4">
          <label className="label">Deskripsi</label>
          <input className="input" value={form.deskripsi}
            onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
        </div>

        {/* Upload gambar */}
        <div className="md:col-span-2">
          <label className="label">Gambar Paket</label>
          <label className={`btn-outline cursor-pointer justify-center w-full ${uploading ? 'opacity-60' : ''}`}>
            {uploading ? 'Mengunggah…' : '📷 Pilih Gambar'}
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="hidden" onChange={uploadImage} disabled={uploading}
              data-testid="paket-gambar" />
          </label>
          <p className="text-[11px] text-slate-400 mt-1">Format jpg / jpeg / png, maks. 5 MB</p>
        </div>

        {form.gambar && (
          <div className="md:col-span-6 flex items-center gap-4 rounded-lg border border-slate-200 p-3">
            <img src={form.gambar} alt="Pratinjau paket"
              className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">Pratinjau gambar</div>
              <div className="text-xs font-mono text-slate-400 truncate">{form.gambar}</div>
            </div>
            <button type="button" onClick={() => setForm({ ...form, gambar: '' })}
              className="btn-outline text-xs">Hapus gambar</button>
          </div>
        )}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="py-2">Gambar</th><th>Nama</th><th>Jenis</th>
              <th>Kuota</th><th>Harga/orang</th><th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2">
                  {p.gambar ? (
                    <img src={p.gambar} alt={p.nama}
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-16 h-16 grid place-items-center rounded-lg bg-slate-100 text-2xl text-slate-300">🐄</div>
                  )}
                </td>
                <td className="font-semibold align-top pt-3">
                  {p.nama}
                  {p.deskripsi && <div className="text-xs text-slate-500 font-normal max-w-[220px]">{p.deskripsi}</div>}
                </td>
                <td className="align-top pt-3">
                  <span className="badge bg-slate-100 text-slate-700">{p.jenis}</span>
                </td>
                <td className="align-top pt-3 text-xs">
                  <div className="font-semibold">{p.terisi || 0} / {p.max_shohibul}</div>
                  <div className="text-slate-500">
                    {sisa(p) > 0 ? `sisa ${sisa(p)} kuota` : 'kuota penuh'}
                  </div>
                </td>
                <td className="align-top pt-3">{rupiah(p.harga_per_orang)}</td>
                <td className="text-right whitespace-nowrap align-top pt-3">
                  <button onClick={() => edit(p)} className="text-primary-700 text-xs font-semibold"
                    data-testid={`paket-edit-${p.id}`}>Edit</button>
                  <button onClick={() => del(p)} className="text-red-600 text-xs font-semibold ml-3"
                    data-testid={`paket-del-${p.id}`}>Hapus</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-slate-500">Belum ada paket.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
