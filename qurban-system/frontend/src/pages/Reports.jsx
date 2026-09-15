import { api } from '../services/api'

export default function Reports() {
  const download = async (fmt) => {
    const url = fmt === 'xlsx' ? '/api/export/rekap.xlsx' : '/api/export/rekap.pdf'
    const r = await api.get(url, { responseType: 'blob' })
    const blob = new Blob([r.data])
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fmt === 'xlsx' ? 'rekap-qurban.xlsx' : 'rekap-qurban.pdf'
    link.click()
  }

  return (
    <div className="space-y-6" data-testid="laporan-page">
      <h1 className="text-2xl font-extrabold">Laporan</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-bold">Rekapitulasi Excel</div>
          <div className="text-sm text-slate-500 mt-1">Peserta, pembayaran, dan distribusi dalam file .xlsx multi-sheet.</div>
          <button onClick={() => download('xlsx')} className="btn-primary mt-4" data-testid="export-xlsx">📊 Unduh XLSX</button>
        </div>
        <div className="card">
          <div className="font-bold">Rekapitulasi PDF</div>
          <div className="text-sm text-slate-500 mt-1">Ringkasan cetak-friendly untuk arsip panitia.</div>
          <button onClick={() => download('pdf')} className="btn-primary mt-4" data-testid="export-pdf">📄 Unduh PDF</button>
        </div>
      </div>
    </div>
  )
}
