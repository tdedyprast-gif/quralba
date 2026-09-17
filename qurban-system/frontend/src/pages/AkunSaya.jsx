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

  useEffect(() => {
    api.get('/api/saya')
      .then(r => setData(r.data))
      .catch(err => toast.error(err.response?.data?.error || 'Gagal memuat data akun'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-slate-500">Memuat…</div>
  if (!data) return <div className="p-8 text-slate-500">Data tidak tersedia.</div>

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
