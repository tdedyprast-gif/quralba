import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const statusBadge = (s) => ({
  lunas: 'bg-green-100 text-green-700',
  cicilan: 'bg-amber-100 text-amber-700',
  belum_lunas: 'bg-slate-100 text-slate-700',
}[s] || 'bg-slate-100 text-slate-700')

export default function AkunSaya() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paketData, setPaketData] = useState(null)
  const [showPilih, setShowPilih] = useState(false)
  const [saving, setSaving] = useState('')

  const loadPaket = () => api.get('/api/saya/paket').then(r => setPaketData(r.data)).catch(() => {})

  useEffect(() => {
    api.get('/api/saya')
      .then(r => {
        setData(r.data)
        // peserta yang sudah tertaut boleh langsung lihat daftar paket
        if (r.data?.role === 'peserta' && r.data?.peserta) loadPaket()
      })
      .catch(err => toast.error(err.response?.data?.error || 'Gagal memuat data akun'))
      .finally(() => setLoading(false))
  }, [])

  // Daftar / ganti paket qurban (self-service)
  const daftarPaket = async (paketId) => {
    setSaving(paketId)
    try {
      const r = await api.post('/api/saya/paket', { paket_id: paketId })
      toast.success(`Berhasil mendaftar paket "${r.data.paket_nama}"`)
      setShowPilih(false)
      const fresh = await api.get('/api/saya')
      setData(fresh.data)
      await loadPaket()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mendaftar paket')
    } finally {
      setSaving('')
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Memuat…</div>
  if (!data) return <div className="p-8 text-slate-500">Data tidak tersedia.</div>

  const punyaPaket = !!data.peserta?.paket_id
  const daftarPaketTersedia = paketData?.paket || []

  return (
    <div className="space-y-6 max-w-3xl" data-testid="akun-page">
      <div>
        <h1 className="text-2xl font-extrabold">Akun Saya</h1>
        <p className="text-sm text-slate-500">Ringkasan data pendaftaran dan status Anda.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold text-lg">{data.nama}</div>
            <div className="text-sm text-slate-500">{data.email}</div>
          </div>
          <div className="flex gap-2">
            <span className="badge bg-slate-100 text-slate-700 capitalize">{data.role}</span>
            <span className="badge bg-green-100 text-green-700">{data.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
          <div><span className="text-slate-500">No. HP:</span> {data.no_hp || '-'}</div>
          <div><span className="text-slate-500">Alamat:</span> {data.alamat || '-'}</div>
        </div>
      </div>

      {/* ── Self-service: pilih / daftar paket qurban ── */}
      {data.role === 'peserta' && data.peserta && (
        <div className="card" data-testid="pilih-paket-card">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="font-bold text-lg">Pendaftaran Paket Qurban</div>
              <div className="text-sm text-slate-500">
                {punyaPaket
                  ? 'Anda sudah terdaftar pada paket di bawah ini.'
                  : 'Pilih salah satu paket qurban, lalu tekan tombol Daftar.'}
              </div>
            </div>
            {punyaPaket && (
              <button type="button" onClick={() => setShowPilih(v => !v)}
                className="btn-outline text-xs" data-testid="ganti-paket-btn">
                {showPilih ? 'Batal' : 'Ganti Paket'}
              </button>
            )}
          </div>

          {punyaPaket && !showPilih && (
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4" data-testid="paket-aktif">
              <div className="text-xs font-bold text-primary-700">PAKET AKTIF ANDA</div>
              <div className="font-extrabold text-lg mt-1">{data.peserta.paket_nama}</div>
              <div className="text-sm text-slate-600 mt-0.5">
                Tagihan {rupiah(data.peserta.total_bayar)} — terbayar {rupiah(data.peserta.total_terbayar)}
              </div>
            </div>
          )}

          {(!punyaPaket || showPilih) && (
            daftarPaketTersedia.length === 0 ? (
              <div className="text-sm text-slate-500 py-4">
                Belum ada paket qurban yang dibuka panitia. Silakan cek kembali nanti.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {daftarPaketTersedia.map(pk => (
                  <div key={pk.id}
                    className={`rounded-xl border overflow-hidden flex flex-col ${
                      pk.dipakai ? 'border-primary-400 ring-2 ring-primary-500/20' : 'border-slate-200'
                    }`}
                    data-testid={`paket-opsi-${pk.id}`}>
                    {pk.gambar ? (
                      <img src={pk.gambar} alt={pk.nama} className="w-full h-36 object-cover" />
                    ) : (
                      <div className="w-full h-36 grid place-items-center bg-slate-100 text-4xl text-slate-300">🐄</div>
                    )}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold">{pk.nama}</div>
                        {pk.dipakai && <span className="badge bg-primary-100 text-primary-700 shrink-0">Aktif</span>}
                      </div>
                      {pk.deskripsi && <div className="text-xs text-slate-500 mt-1">{pk.deskripsi}</div>}
                      <div className="text-lg font-extrabold text-primary-700 mt-2">
                        {rupiah(pk.harga_per_orang)}
                        <span className="text-xs font-normal text-slate-500"> / orang</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Kuota {pk.terisi}/{pk.max_shohibul} terisi
                        {!pk.penuh && <> — sisa <b>{pk.sisa}</b> slot</>}
                      </div>
                      <button
                        type="button"
                        disabled={pk.penuh || pk.dipakai || saving === pk.id}
                        onClick={() => daftarPaket(pk.id)}
                        data-testid={`daftar-paket-${pk.id}`}
                        className={`mt-3 justify-center ${
                          pk.penuh || pk.dipakai ? 'btn-outline opacity-60 cursor-not-allowed' : 'btn-primary'
                        }`}>
                        {saving === pk.id ? 'Memproses…'
                          : pk.dipakai ? 'Sudah Terdaftar'
                          : pk.penuh ? 'Kuota Penuh'
                          : 'Daftar Paket Ini'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {data.peserta && (
        <>
          <div className="card">
            <div className="font-bold mb-3">Status Qurban</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500">Paket</div>
                <div className="font-semibold">{data.peserta.paket_nama || 'Belum dipilih'}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Status Pembayaran</div>
                <span className={`badge ${statusBadge(data.peserta.status_bayar)}`}>{data.peserta.status_bayar}</span>
              </div>
              <div>
                <div className="text-sm text-slate-500">Total Tagihan</div>
                <div className="font-semibold">{rupiah(data.peserta.total_bayar)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Sudah Dibayar</div>
                <div className="font-semibold text-primary-700">{rupiah(data.peserta.total_terbayar)}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-slate-500 mb-1">Sisa</div>
              <div className="text-xl font-extrabold">
                {rupiah(Number(data.peserta.total_bayar) - Number(data.peserta.total_terbayar))}
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <div className="font-bold mb-3">Riwayat Pembayaran</div>
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left">
                <tr><th className="py-2">Tanggal</th><th>Jumlah</th><th>Metode</th><th>Referensi</th></tr>
              </thead>
              <tbody>
                {(data.peserta.riwayat_pembayaran || []).map(r => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 text-xs">{new Date(r.paid_at).toLocaleDateString('id-ID')}</td>
                    <td className="font-semibold">{rupiah(r.amount)}</td>
                    <td className="capitalize">{r.metode}</td>
                    <td className="text-xs text-slate-500">{r.referensi || '-'}</td>
                  </tr>
                ))}
                {(!data.peserta.riwayat_pembayaran || data.peserta.riwayat_pembayaran.length === 0) && (
                  <tr><td colSpan={4} className="text-center py-6 text-slate-500">Belum ada pembayaran.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.penerima && (
        <div className="card text-center">
          <div className="font-bold mb-1">Kartu Penerima Daging</div>
          <div className="text-xs text-slate-500 mb-4">Tunjukkan QR ini kepada panitia saat pengambilan daging.</div>
          <div className="bg-white p-4 inline-block rounded-xl border border-slate-200">
            <QRCodeCanvas value={data.penerima.qr_value} size={220} />
          </div>
          <div className="mt-4">
            <div className="font-mono text-sm">{data.penerima.kode}</div>
            <div className="text-sm text-slate-500">{data.penerima.kategori}</div>
          </div>
          <div className="mt-4">
            {data.penerima.diambil ? (
              <span className="badge bg-green-100 text-green-700">✓ Sudah diambil</span>
            ) : (
              <span className="badge bg-amber-100 text-amber-700">Belum diambil</span>
            )}
          </div>
        </div>
      )}

      {!data.peserta && !data.penerima && data.role !== 'admin' && (
        <div className="card text-sm text-slate-500">
          Belum ada data yang tertaut ke akun ini. Hubungi panitia admin.
        </div>
      )}
    </div>
  )
}
