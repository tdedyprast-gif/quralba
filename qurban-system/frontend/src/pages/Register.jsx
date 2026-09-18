import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'peserta', label: 'Peserta Qurban', desc: 'Shohibul qurban — mendaftar paket & bayar', icon: '🐄' },
  { value: 'penerima', label: 'Penerima Daging', desc: 'Menerima daging qurban — dapat QR pengambilan', icon: '📦' },
]

export default function Register() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const paketParam = searchParams.get('paket') || ''
  const [role, setRole] = useState('peserta')
  const [paket, setPaket] = useState([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)
  const [form, setForm] = useState({
    nama: '', email: '', password: '', no_hp: '', alamat: '', paket_id: paketParam,
  })

  useEffect(() => {
    api.get('/api/public/paket').then(r => setPaket(r.data || [])).catch(() => { })
  }, [])

  const paketDipilih = paket.find(p => p.id === form.paket_id)
  // kuota bisa saja habis setelah halaman landing dibuka
  const sisaPaketDipilih = paketDipilih
    ? Math.max(0, Number(paketDipilih.max_shohibul || 0) - Number(paketDipilih.terisi || 0))
    : 0
  const paketDipilihPenuh = !!paketDipilih && sisaPaketDipilih <= 0

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, role, paket_id: role === 'peserta' ? form.paket_id : '' }
      const r = await api.post('/api/auth/register', payload)
      setDone(r.data)
      toast.success('Pendaftaran terkirim')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pendaftaran gagal')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="card w-full max-w-lg text-center" data-testid="register-success">
          <div className="text-5xl mb-3">⏳</div>
          <h1 className="text-xl font-extrabold">Pendaftaran Berhasil</h1>
          <p className="text-sm text-slate-500 mt-2">
            Akun <b>{form.email}</b> sudah terdaftar sebagai <b>{role}</b>.
            Akun Anda menunggu <b>validasi panitia admin</b> sebelum bisa digunakan untuk masuk.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/login" className="btn-primary">Ke Halaman Masuk</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <form onSubmit={submit} className="card w-full max-w-2xl" data-testid="register-form">
        <div className="text-center mb-6">
          <div className="text-2xl font-extrabold text-primary-700">Daftar Akun Qurban</div>
          <div className="text-sm text-slate-500 mt-1">Pilih jenis akun, lalu lengkapi data Anda</div>
        </div>

        {paketDipilih && (
          <div className={`mb-5 rounded-xl border p-4 ${paketDipilihPenuh ? 'border-red-300 bg-red-50' : 'border-primary-200 bg-primary-50'
            }`} data-testid="banner-paket">
            <div className={`text-xs font-bold ${paketDipilihPenuh ? 'text-red-700' : 'text-primary-700'}`}>
              {paketDipilihPenuh ? 'PAKET TERPILIH — KUOTA PENUH' : 'PAKET TERPILIH'}
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <div>
                <div className="font-bold">{paketDipilih.nama}</div>
                <div className="text-sm text-slate-600">
                  Rp {Number(paketDipilih.harga_per_orang).toLocaleString('id-ID')} / orang
                </div>
                {paketDipilihPenuh ? (
                  <div className="text-xs font-semibold text-red-600 mt-1">
                    Kuota paket ini sudah penuh — silakan pilih paket lain, atau tetap daftar dan
                    paket ditentukan panitia.
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-1">sisa {sisaPaketDipilih} kuota</div>
                )}
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, paket_id: '' }))}
                className="btn-outline text-xs shrink-0">Ganti</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {ROLES.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              data-testid={`register-role-${r.value}`}
              className={`text-left rounded-xl border p-4 transition ${role === r.value ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20' : 'border-slate-200 hover:bg-slate-50'
                }`}
            >
              <div className="text-2xl">{r.icon}</div>
              <div className="font-bold text-sm mt-1">{r.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nama Lengkap *</label>
            <input required className="input" value={form.nama}
              onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="register-nama" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input required type="email" className="input" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} data-testid="register-email" />
          </div>
          <div>
            <label className="label">Password * <span className="text-xs text-slate-400">(min. 6 karakter)</span></label>
            <input required type="password" minLength={6} className="input" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} data-testid="register-password" />
          </div>
          <div>
            <label className="label">No. HP / WhatsApp</label>
            <input className="input" value={form.no_hp}
              onChange={e => setForm({ ...form, no_hp: e.target.value })} data-testid="register-nohp" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Alamat</label>
            <input className="input" value={form.alamat}
              onChange={e => setForm({ ...form, alamat: e.target.value })} data-testid="register-alamat" />
          </div>

          {role === 'peserta' && (
            <div className="md:col-span-2">
              <label className="label">Pilihan Paket Sapi</label>
              <select className="input" value={form.paket_id}
                onChange={e => setForm({ ...form, paket_id: e.target.value })} data-testid="register-paket">
                <option value="">-- Pilih paket (bisa ditentukan admin nanti) --</option>
                {paket.map(p => {
                  const sisa = Math.max(0, Number(p.max_shohibul || 0) - Number(p.terisi || 0))
                  return (
                    <option key={p.id} value={p.id} disabled={sisa <= 0}>
                      {p.nama} — Rp {Number(p.harga_per_orang).toLocaleString('id-ID')}
                      {sisa <= 0 ? ' (kuota penuh)' : ` (sisa ${sisa} kuota)`}
                    </option>
                  )
                })}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Kuota terbatas — paket yang sudah penuh tidak bisa dipilih.
              </p>
            </div>
          )}
        </div>

        <button disabled={loading} className="btn-primary w-full justify-center mt-6" data-testid="register-submit">
          {loading ? 'Mengirim…' : 'Daftar Sekarang'}
        </button>

        <div className="text-center text-sm text-slate-500 mt-4">
          Sudah punya akun? <Link to="/login" className="text-primary-700 font-semibold">Masuk di sini</Link>
        </div>
        <div className="text-center text-sm mt-2">
          <Link to="/" className="text-slate-500 hover:text-primary-700">← Kembali ke beranda</Link>
        </div>
      </form>
    </div>
  )
}
