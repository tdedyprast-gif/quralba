import { useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const METODE = ['tunai', 'transfer', 'qris', 'doit']

export default function Bendahara() {
  const [tab, setTab] = useState('pembayaran')

  return (
    <div className="space-y-6" data-testid="bendahara-page">
      <div>
        <h1 className="text-2xl font-extrabold">Bendahara</h1>
        <p className="text-sm text-slate-500">Kelola paket sapi dan catat pembayaran peserta qurban.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('pembayaran')} data-testid="tab-pembayaran"
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'pembayaran' ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>Pencatatan Pembayaran</button>
        <button onClick={() => setTab('paket')} data-testid="tab-paket"
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'paket' ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>Paket Sapi</button>
      </div>

      {tab === 'pembayaran' ? <PembayaranTab /> : <PaketTab />}
    </div>
  )
}

/* ─────────────────────────── Pembayaran ─────────────────────────── */

function PembayaranTab() {
  const [rekap, setRekap] = useState(null)
  const [peserta, setPeserta] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [form, setForm] = useState({
    peserta_id: '', amount: '', metode: 'tunai', referensi: '', catatan: '', paid_at: '',
  })

  const load = async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get('/api/pembayaran/rekap'),
        api.get('/api/peserta'),
        api.get('/api/pembayaran'),
      ])
      setRekap(r1.data)
      setPeserta(r2.data || [])
      setRiwayat(r3.data || [])
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal memuat data') }
  }
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.peserta_id) return toast.error('Pilih peserta dulu')
    try {
      const r = await api.post('/api/pembayaran', { ...form, amount: Number(form.amount) })
      toast.success(`Pembayaran dicatat — status: ${r.data.status_bayar}`)
      setForm({ peserta_id: '', amount: '', metode: 'tunai', referensi: '', catatan: '', paid_at: '' })
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menyimpan') }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus catatan pembayaran ini? Status peserta akan dihitung ulang.')) return
    try {
      await api.delete(`/api/pembayaran/${id}`)
      toast.success('Pembayaran dihapus'); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menghapus') }
  }

  const pilihPeserta = (id) => {
    const p = peserta.find(x => x.id === id)
    const sisa = p ? Math.max(0, Number(p.total_bayar) - Number(p.total_terbayar)) : ''
    setForm(f => ({ ...f, peserta_id: id, amount: sisa === '' ? '' : String(sisa) }))
  }

  const statusBadge = (s) => ({
    lunas: 'bg-green-100 text-green-700',
    cicilan: 'bg-amber-100 text-amber-700',
    belum_lunas: 'bg-slate-100 text-slate-700',
  }[s] || 'bg-slate-100 text-slate-700')

  const terpilih = peserta.find(p => p.id === form.peserta_id)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Total Penerimaan</div>
          <div className="text-2xl font-extrabold mt-1 text-primary-700">{rupiah(rekap?.total_masuk)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Total Tagihan</div>
          <div className="text-2xl font-extrabold mt-1">{rupiah(rekap?.total_tagihan)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Belum Terbayar</div>
          <div className="text-2xl font-extrabold mt-1 text-amber-600">{rupiah(rekap?.outstanding)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Peserta Lunas</div>
          <div className="text-2xl font-extrabold mt-1">
            {rekap?.peserta_lunas ?? '-'}
            <span className="text-sm font-normal text-slate-400"> / {(rekap?.peserta_lunas ?? 0) + (rekap?.peserta_cicilan ?? 0) + (rekap?.peserta_belum_lunas ?? 0)}</span>
          </div>
        </div>
      </div>

      {rekap?.per_metode?.length > 0 && (
        <div className="card">
          <div className="font-bold mb-3 text-sm">Rincian per Metode</div>
          <div className="flex flex-wrap gap-4">
            {rekap.per_metode.map(m => (
              <div key={m.metode} className="text-sm">
                <span className="badge bg-slate-100 text-slate-700 capitalize">{m.metode}</span>
                <span className="ml-2 font-semibold">{rupiah(m.total)}</span>
                <span className="text-xs text-slate-400 ml-1">({m.jumlah}x)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end" data-testid="pembayaran-form">
        <div className="md:col-span-2">
          <label className="label">Peserta *</label>
          <select className="input" value={form.peserta_id} onChange={e => pilihPeserta(e.target.value)} data-testid="bayar-peserta">
            <option value="">-- Pilih peserta --</option>
            {peserta.map(p => (
              <option key={p.id} value={p.id}>
                {p.nama} — {rupiah(p.total_terbayar)}/{rupiah(p.total_bayar)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jumlah *</label>
          <input required type="number" min="1" className="input" value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="bayar-amount" />
        </div>
        <div>
          <label className="label">Metode</label>
          <select className="input" value={form.metode} onChange={e => setForm({ ...form, metode: e.target.value })}>
            {METODE.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tanggal</label>
          <input type="date" className="input" value={form.paid_at}
            onChange={e => setForm({ ...form, paid_at: e.target.value })} />
        </div>
        <button className="btn-primary justify-center" data-testid="bayar-submit">Catat</button>
        <div className="md:col-span-3">
          <label className="label">Referensi / No. Bukti</label>
          <input className="input" value={form.referensi}
            onChange={e => setForm({ ...form, referensi: e.target.value })} placeholder="No. transfer, no. kuitansi, dll" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Catatan</label>
          <input className="input" value={form.catatan}
            onChange={e => setForm({ ...form, catatan: e.target.value })} />
        </div>
      </form>

      {terpilih && (
        <div className="text-sm bg-primary-50 border border-primary-100 rounded-lg p-3">
          <b>{terpilih.nama}</b> — tagihan {rupiah(terpilih.total_bayar)}, terbayar {rupiah(terpilih.total_terbayar)},
          sisa <b>{rupiah(Number(terpilih.total_bayar) - Number(terpilih.total_terbayar))}</b>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="font-bold mb-3">Riwayat Pembayaran</div>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Tanggal</th><th>Peserta</th><th>Jumlah</th><th>Metode</th><th>Referensi</th><th>Petugas</th><th></th></tr>
          </thead>
          <tbody>
            {riwayat.map(pb => (
              <tr key={pb.id} className="border-t border-slate-100">
                <td className="py-2 text-xs">{new Date(pb.paid_at).toLocaleDateString('id-ID')}</td>
                <td className="font-semibold">{pb.nama_peserta}</td>
                <td>{rupiah(pb.amount)}</td>
                <td><span className="badge bg-slate-100 text-slate-700 capitalize">{pb.metode}</span></td>
                <td className="text-xs">{pb.referensi || '-'}</td>
                <td className="text-xs">{pb.nama_petugas || '-'}</td>
                <td className="text-right">
                  <button onClick={() => hapus(pb.id)} className="text-red-600 text-xs font-semibold"
                    data-testid={`hapus-bayar-${pb.id}`}>Hapus</button>
                </td>
              </tr>
            ))}
            {riwayat.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-slate-500">Belum ada pembayaran tercatat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────── Paket ─────────────────────────── */

function PaketTab() {
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nama: '', jenis: 'sapi_penuh', max_shohibul: 1, harga_per_orang: '', deskripsi: '' })

  const load = () => api.get('/api/paket').then(r => setItems(r.data || []))
  useEffect(() => { load() }, [])

  const reset = () => { setForm({ nama: '', jenis: 'sapi_penuh', max_shohibul: 1, harga_per_orang: '', deskripsi: '' }); setEditing(null) }

  const submit = async (e) => {
    e.preventDefault()
    const payload = { ...form, max_shohibul: Number(form.max_shohibul), harga_per_orang: Number(form.harga_per_orang) }
    try {
      if (editing) await api.put(`/api/paket/${editing}`, payload)
      else await api.post('/api/paket', payload)
      toast.success(editing ? 'Paket diperbarui' : 'Paket ditambahkan')
      reset(); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menyimpan') }
  }

  const edit = (p) => {
    setEditing(p.id)
    setForm({ nama: p.nama, jenis: p.jenis, max_shohibul: p.max_shohibul, harga_per_orang: p.harga_per_orang, deskripsi: p.deskripsi || '' })
  }

  const hapus = async (id) => {
    if (!confirm('Hapus paket ini?')) return
    try { await api.delete(`/api/paket/${id}`); toast.success('Paket dihapus'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Gagal menghapus') }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end" data-testid="paket-form">
        <div className="md:col-span-2">
          <label className="label">Nama Paket *</label>
          <input required className="input" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="paket-nama" />
        </div>
        <div>
          <label className="label">Jenis</label>
          <select className="input" value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value })}>
            <option value="sapi_penuh">Sapi Penuh</option>
            <option value="patungan_1_7">Patungan 1/7</option>
            <option value="mandiri">Mandiri</option>
          </select>
        </div>
        <div>
          <label className="label">Maks. Shohibul</label>
          <input type="number" min="1" className="input" value={form.max_shohibul} onChange={e => setForm({ ...form, max_shohibul: e.target.value })} />
        </div>
        <div>
          <label className="label">Harga / Orang *</label>
          <input required type="number" min="0" className="input" value={form.harga_per_orang} onChange={e => setForm({ ...form, harga_per_orang: e.target.value })} data-testid="paket-harga" />
        </div>
        <div className="md:col-span-4">
          <label className="label">Deskripsi</label>
          <input className="input" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center" data-testid="paket-submit">{editing ? 'Perbarui' : 'Tambah'}</button>
          {editing && <button type="button" onClick={reset} className="btn-outline">Batal</button>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr><th className="py-2">Nama</th><th>Jenis</th><th>Maks</th><th>Harga/Orang</th><th>Deskripsi</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 font-semibold">{p.nama}</td>
                <td><span className="badge bg-slate-100 text-slate-700">{p.jenis}</span></td>
                <td>{p.max_shohibul}</td>
                <td>{rupiah(p.harga_per_orang)}</td>
                <td className="text-xs text-slate-500 max-w-[240px]">{p.deskripsi || '-'}</td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => edit(p)} className="text-primary-700 text-xs font-semibold">Edit</button>
                  <button onClick={() => hapus(p.id)} className="text-red-600 text-xs font-semibold ml-3">Hapus</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-500">Belum ada paket.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
