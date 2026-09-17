import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const JENIS_LABEL = {
  sapi_penuh: 'Sapi Penuh',
  patungan_1_7: 'Patungan 1/7',
  mandiri: 'Mandiri',
}

const ALUR = [
  { icon: '📝', judul: 'Daftar Akun', teks: 'Pilih paket qurban lalu isi data pendaftaran Anda.' },
  { icon: '✅', judul: 'Validasi Panitia', teks: 'Panitia admin memverifikasi data pendaftaran Anda.' },
  { icon: '💳', judul: 'Bayar Tagihan', teks: 'Bayar tunai/transfer ke bendahara, atau via invoice online.' },
  { icon: '🐄', judul: 'Qurban Terlaksana', teks: 'Anda tercatat sebagai shohibul qurban pada hari raya Idul Adha.' },
]

export default function Landing() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [paket, setPaket] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/public/paket')
      .then(r => setPaket(r.data || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const daftar = (id) => {
    if (user) {
      // sudah login sebagai panitia → arahkan ke pengelolaan paket
      nav('/dashboard')
      return
    }
    nav(`/register?paket=${id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="landing-page">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🕌</span>
            <div>
              <div className="font-extrabold text-primary-700 leading-tight">TPA Alba</div>
              <div className="text-[11px] text-slate-500 leading-tight">Quralba</div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <a href="#paket" className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary-700">
              Paket Qurban
            </a>
            <a href="#alur" className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary-700">
              Alur Pendaftaran
            </a>
            {user ? (
              <Link to="/dashboard" className="btn-primary" data-testid="landing-dashboard">
                Buka Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-outline" data-testid="landing-daftar-top">
                  Daftar
                </Link>
                <Link to="/login" className="btn-primary" data-testid="landing-login">
                  Masuk
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-slate-100 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
          <span className="badge bg-primary-50 text-primary-700">Idul Adha 1447 H</span>
          <h1 className="text-3xl md:text-5xl font-extrabold mt-4 text-slate-800">
            Titipkan Qurban Anda,<br className="hidden md:block" /> Kami Kelola dengan Amanah
          </h1>
          <p className="text-slate-600 mt-4 max-w-2xl mx-auto">
            Pendaftaran shohibul qurban, pencatatan pembayaran, hingga distribusi daging
            kepada yang berhak — semuanya tercatat rapi dan transparan.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <a href="#paket" className="btn-primary px-6 py-3 text-base" data-testid="hero-lihat-paket">
              Lihat Paket Qurban
            </a>
            {!user && (
              <Link to="/login" className="btn-outline px-6 py-3 text-base" data-testid="hero-login">
                Masuk Panitia / Peserta
              </Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-12">
            <div>
              <div className="text-2xl font-extrabold text-primary-700">{paket.length}</div>
              <div className="text-xs text-slate-500 mt-1">Paket tersedia</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-primary-700">
                {paket.reduce((s, p) => s + (p.terisi || 0), 0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Shohibul terdaftar</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-primary-700">
                {paket.reduce((s, p) => s + Math.max(0, (p.max_shohibul || 0) - (p.terisi || 0)), 0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Kuota tersisa</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Paket ── */}
      <section id="paket" className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold">Paket Qurban</h2>
          <p className="text-slate-600 mt-2">Pilih paket, lalu klik Daftar untuk mengisi formulir pendaftaran.</p>
        </div>

        {loading && <div className="text-center text-slate-500 py-12">Memuat paket…</div>}

        {!loading && paket.length === 0 && (
          <div className="card text-center text-slate-500 py-12">
            Belum ada paket qurban yang dibuka. Silakan hubungi panitia.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paket.map(p => {
            const penuh = p.max_shohibul > 0 && p.terisi >= p.max_shohibul
            const persen = p.max_shohibul > 0 ? Math.min(100, Math.round((p.terisi / p.max_shohibul) * 100)) : 0
            return (
              <div key={p.id} className="card p-0 overflow-hidden flex flex-col" data-testid={`paket-card-${p.id}`}>
                <div className="h-44 bg-slate-100 overflow-hidden">
                  {p.gambar ? (
                    <img src={p.gambar} alt={p.nama} className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-5xl text-slate-300">🐄</div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-tight">{p.nama}</h3>
                    <span className="badge bg-primary-50 text-primary-700 whitespace-nowrap">
                      {JENIS_LABEL[p.jenis] || p.jenis}
                    </span>
                  </div>
                  {p.deskripsi && <p className="text-sm text-slate-500 mt-2">{p.deskripsi}</p>}

                  <div className="mt-4">
                    <div className="text-2xl font-extrabold text-primary-700">{rupiah(p.harga_per_orang)}</div>
                    <div className="text-xs text-slate-500">per orang / shohibul</div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Kuota terisi</span>
                      <span>{p.terisi || 0} / {p.max_shohibul}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${penuh ? 'bg-red-400' : 'bg-primary-600'}`}
                        style={{ width: `${persen}%` }} />
                    </div>
                  </div>

                  <button
                    disabled={penuh}
                    onClick={() => daftar(p.id)}
                    data-testid={`paket-daftar-${p.id}`}
                    className={`mt-5 w-full justify-center ${penuh ? 'btn-outline opacity-60 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {penuh ? 'Kuota Penuh' : 'Daftar Paket Ini'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Alur ── */}
      <section id="alur" className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold">Alur Pendaftaran</h2>
            <p className="text-slate-600 mt-2">Empat langkah mudah menjadi shohibul qurban.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ALUR.map((s, i) => (
              <div key={s.judul} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 grid place-items-center text-2xl mx-auto">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-primary-700 mt-3">LANGKAH {i + 1}</div>
                <div className="font-bold mt-1">{s.judul}</div>
                <p className="text-sm text-slate-500 mt-1">{s.teks}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="card bg-primary-50 border-primary-100 text-center py-12">
          <h2 className="text-xl md:text-2xl font-extrabold">Sudah siap berqurban tahun ini?</h2>
          <p className="text-slate-600 mt-2">Daftar sekarang, atau masuk jika Anda sudah punya akun.</p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link to="/register" className="btn-primary px-6 py-3" data-testid="cta-daftar">Daftar Sekarang</Link>
            <Link to="/login" className="btn-outline px-6 py-3" data-testid="cta-login">Masuk</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            © {new Date().getFullYear()} Sistem Qurban — Panitia Idul Adha
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/register" className="text-slate-600 hover:text-primary-700">Daftar</Link>
            <Link to="/login" className="text-slate-600 hover:text-primary-700">Masuk</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
