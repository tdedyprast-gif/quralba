import { useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const emptyForm = { nama: '', no_hp: '', email: '', alamat: '', paket_id: '' }

export default function Peserta() {
  const [items, setItems] = useState([])
  const [paket, setPaket] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)   // peserta yang sedang diubah
  const [saving, setSaving] = useState('')
  const [cari, setCari] = useState('')
  const [filter, setFilter] = useState('semua')  // semua | belum_paket | sudah_paket

  const load = () => api.get('/api/peserta').then(r => setItems(r.data || []))
  const loadPaket = () => api.get('/api/paket').then(r => setPaket(r.data || []))
  useEffect(() => { load(); loadPaket() }, [])

  const sisa = (pk) => Math.max(0, Number(pk.max_shohibul || 0) - Number(pk.terisi || 0))

  // ── Tambah peserta baru + langsung pilih paket ──
  const submit = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, paket_id: form.paket_id || null }
      await api.post('/api/peserta', payload)
      toast.success('Peserta didaftarkan')
      setForm(emptyForm)
      load(); loadPaket()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal') }
  }

  // ── Tetapkan / ganti paket untuk pendaftar qurban (langsung tersimpan) ──
  const ubahPaket = async (p, paketId) => {
    setSaving(p.id)
    try {
      await api.put(`/api/peserta/${p.id}`, {
        nama: p.nama,
        no_hp: p.no_hp || '',
        alamat: p.alamat || '',
        email: p.email || '',
        slot_ke: p.slot_ke || 1,
        paket_id: paketId || null,
      })
      toast.success(paketId ? 'Paket berhasil ditetapkan' : 'Paket dilepas')
      load(); loadPaket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menetapkan paket')
    } finally { setSaving('') }
  }

  // ── Ubah data peserta lengkap (modal) ──
  const simpanEdit = async (e) => {
    e.preventDefault()
    setSaving(editing.id)
    try {
      await api.put(`/api/peserta/${editing.id}`, {
        nama: editing.nama,
        no_hp: editing.no_hp || '',
        alamat: editing.alamat || '',
        email: editing.email || '',
        slot_ke: editing.slot_ke || 1,
        paket_id: editing.paket_id || null,
      })
      toast.success('Data peserta diperbarui')
      setEditing(null)
      load(); loadPaket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    } finally { setSaving('') }
  }

  const buatTagihan = async (id) => {
    try {
      // origin apa adanya — request lewat Nginx reverse proxy, bukan port backend langsung
      const r = await api.post(`/api/peserta/${id}/invoice`, {}, { headers: { 'X-Callback-Base': window.location.origin } })
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
      toast.success(`Berhasil import ${r.data.inserted} baris`); load(); loadPaket()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal import') }
    e.target.value = ''
  }

  const badge = (s) => ({
    lunas: 'bg-green-100 text-green-700',
    cicilan: 'bg-amber-100 text-amber-700',
    belum_lunas: 'bg-slate-100 text-slate-700',
  }[s] || 'bg-slate-100 text-slate-700')

  const tampil = items.filter(p => {
    if (filter === 'belum_paket' && p.paket_id) return false
    if (filter === 'sudah_paket' && !p.paket_id) return false
    if (!cari.trim()) return true
    const q = cari.toLowerCase()
    return (p.nama || '').toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q)
      || (p.no_hp || '').toLowerCase().includes(q)
  })

  const jumlahBelumPaket = items.filter(p => !p.paket_id).length

  return (
    <div className="space-y-6" data-testid="peserta-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Peserta Qurban (Shohibul)</h1>
          <p className="text-sm text-slate-500">
            Daftarkan peserta dan tetapkan paket qurban untuk pendaftar.
          </p>
        </div>
        <label className="btn-outline cursor-pointer">
          📥 Import XLSX
          <input type="file" accept=".xlsx" className="hidden" onChange={importFile} data-testid="peserta-import" />
        </label>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Total Peserta</div>
          <div className="text-2xl font-extrabold mt-1">{items.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Sudah Punya Paket</div>
          <div className="text-2xl font-extrabold mt-1 text-primary-700">{items.length - jumlahBelumPaket}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Belum Ditetapkan Paket</div>
          <div className="text-2xl font-extrabold mt-1 text-amber-600">{jumlahBelumPaket}</div>
        </div>
      </div>

      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end" data-testid="peserta-form">
        <div className="md:col-span-2">
          <label className="label">Nama *</label>
          <input required className="input" value={form.nama}
            onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="peserta-nama" />
        </div>
        <div>
          <label className="label">No. HP</label>
          <input className="input" value={form.no_hp} onChange={e => setForm({ ...form, no_hp: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Paket Qurban</label>
          <select className="input" value={form.paket_id}
            onChange={e => setForm({ ...form, paket_id: e.target.value })} data-testid="peserta-paket">
            <option value="">-- Pilih paket --</option>
            {paket.map(p => (
              <option key={p.id} value={p.id} disabled={sisa(p) <= 0}>
                {p.nama} — {rupiah(p.harga_per_orang)}{sisa(p) <= 0 ? ' (penuh)' : ` (sisa ${sisa(p)})`}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary justify-center" data-testid="peserta-submit">Daftarkan</button>
        <div className="md:col-span-6">
          <label className="label">Alamat</label>
          <input className="input" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} />
        </div>
      </form>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="font-bold">Daftar Peserta</div>
          <div className="flex items-center gap-2">
            <input className="input py-1.5 text-sm w-44" placeholder="Cari nama / email / HP"
              value={cari} onChange={e => setCari(e.target.value)} data-testid="peserta-cari" />
            <select className="input py-1.5 text-sm w-44" value={filter}
              onChange={e => setFilter(e.target.value)} data-testid="peserta-filter">
              <option value="semua">Semua peserta</option>
              <option value="belum_paket">Belum ada paket</option>
              <option value="sudah_paket">Sudah ada paket</option>
            </select>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="py-2">Nama</th><th>Kontak</th><th>Paket Qurban</th>
              <th>Tagihan</th><th>Status</th><th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 font-semibold align-top">{p.nama}</td>
                <td className="align-top">{p.no_hp || '-'}<div className="text-xs text-slate-500">{p.email}</div></td>

                {/* Penetapan paket langsung dari tabel */}
                <td className="align-top pt-1.5">
                  <select
                    className={`input py-1 text-xs max-w-[210px] ${p.paket_id ? '' : 'border-amber-300 bg-amber-50'}`}
                    value={p.paket_id || ''}
                    disabled={saving === p.id}
                    onChange={e => ubahPaket(p, e.target.value)}
                    data-testid={`peserta-paket-select-${p.id}`}>
                    <option value="">— Belum ditetapkan —</option>
                    {paket.map(pk => (
                      <option key={pk.id} value={pk.id}
                        disabled={sisa(pk) <= 0 && pk.id !== p.paket_id}>
                        {pk.nama}{sisa(pk) <= 0 && pk.id !== p.paket_id ? ' (penuh)' : ` (sisa ${sisa(pk)})`}
                      </option>
                    ))}
                  </select>
                  {!p.paket_id && (
                    <div className="text-[11px] text-amber-600 mt-0.5">Pilih paket untuk pendaftar ini</div>
                  )}
                </td>

                <td className="align-top">
                  {rupiah(p.total_bayar)}
                  <div className="text-xs text-slate-500">Terbayar: {rupiah(p.total_terbayar)}</div>
                </td>
                <td className="align-top"><span className={`badge ${badge(p.status_bayar)}`}>{p.status_bayar}</span></td>
                <td className="text-right whitespace-nowrap align-top">
                  <button onClick={() => setEditing({ ...p })} className="text-primary-700 text-xs font-semibold"
                    data-testid={`peserta-edit-${p.id}`}>Edit</button>
                  {p.doit_invoice_url ? (
                    <a href={p.doit_invoice_url} target="_blank" rel="noreferrer"
                      className="text-primary-700 text-xs font-semibold ml-3">Invoice</a>
                  ) : (
                    <button onClick={() => buatTagihan(p.id)} className="btn-outline text-xs ml-3"
                      disabled={!p.total_bayar}
                      data-testid={`peserta-invoice-${p.id}`}>Buat Tagihan</button>
                  )}
                </td>
              </tr>
            ))}
            {tampil.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-slate-500">
                {items.length === 0 ? 'Belum ada peserta.' : 'Tidak ada peserta yang cocok dengan filter.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal edit peserta ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50" data-testid="peserta-edit-modal">
          <form onSubmit={simpanEdit} className="card w-full max-w-lg space-y-3 bg-white">
            <div className="font-bold text-lg">Edit Peserta</div>

            <div>
              <label className="label">Nama *</label>
              <input required className="input" value={editing.nama}
                onChange={e => setEditing({ ...editing, nama: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">No. HP</label>
                <input className="input" value={editing.no_hp || ''}
                  onChange={e => setEditing({ ...editing, no_hp: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editing.email || ''}
                  onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Alamat</label>
              <input className="input" value={editing.alamat || ''}
                onChange={e => setEditing({ ...editing, alamat: e.target.value })} />
            </div>
            <div>
              <label className="label">Paket Qurban</label>
              <select className="input" value={editing.paket_id || ''}
                onChange={e => setEditing({ ...editing, paket_id: e.target.value })}
                data-testid="peserta-edit-paket">
                <option value="">— Belum ditetapkan —</option>
                {paket.map(pk => (
                  <option key={pk.id} value={pk.id}
                    disabled={sisa(pk) <= 0 && pk.id !== editing.paket_id}>
                    {pk.nama} — {rupiah(pk.harga_per_orang)}{sisa(pk) <= 0 && pk.id !== editing.paket_id ? ' (penuh)' : ` (sisa ${sisa(pk)})`}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Mengganti paket akan menyesuaikan tagihan ke harga paket baru secara otomatis.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-outline">Batal</button>
              <button className="btn-primary" disabled={saving === editing.id}
                data-testid="peserta-edit-simpan">
                {saving === editing.id ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
