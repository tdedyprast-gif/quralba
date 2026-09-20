import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function QRScanner() {
  const scannerRef = useRef(null)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [manual, setManual] = useState('')

  useEffect(() => () => stop(), [])

  const submitScan = async (qrValue) => {
    try {
      const r = await api.post('/api/distribusi/scan', { qr_value: qrValue })
      setLastResult({ ok: true, ...r.data.data })
      toast.success(`✓ ${r.data.data.nama} — terdaftar diambil`)
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal memindai'
      const p = err.response?.data?.penerima
      setLastResult({ ok: false, error: msg, ...(p || {}) })
      toast.error(msg)
    }
  }

  const apiBase = import.meta.env.VITE_API_URL ?? ''
  const sertifikatURL = (id) => `${apiBase}/api/penerima/${id}/sertifikat`

  const start = async () => {
    if (running) return
    const el = document.getElementById('qr-reader')
    if (!el) return
    scannerRef.current = new Html5Qrcode('qr-reader')
    try {
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText) => {
          // debounce: stop temporarily after scan
          await scannerRef.current.pause(true)
          await submitScan(decodedText)
          setTimeout(async () => {
            try { await scannerRef.current.resume() } catch {}
          }, 1500)
        },
        () => {}
      )
      setRunning(true)
    } catch (err) {
      toast.error('Kamera tidak tersedia: ' + err)
    }
  }

  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { await scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
    setRunning(false)
  }

  const submitManual = (e) => {
    e.preventDefault()
    if (manual.trim()) { submitScan(manual.trim()); setManual('') }
  }

  const handleFileUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const html5QrCode = new Html5Qrcode('qr-reader')
    try {
      const decodedText = await html5QrCode.scanFile(file, false)
      await submitScan(decodedText)
    } catch (err) {
      toast.error('Gagal membaca QR dari gambar, pastikan gambar jelas.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="scanner-page">
      <div>
        <h1 className="text-2xl font-extrabold">Pemindai QR Code</h1>
        <p className="text-sm text-slate-500">Arahkan kamera ke tiket QR penerima daging qurban.</p>
      </div>

      <div className="card">
        <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-slate-900 min-h-[300px] flex items-center justify-center text-white">
          {!running && <div className="text-slate-400 text-sm">Kamera belum aktif</div>}
        </div>
        <div className="flex gap-3 mt-4">
          {!running ? (
            <button data-testid="scan-start" onClick={start} className="btn-primary flex-1 justify-center">▶ Mulai Kamera</button>
          ) : (
            <button data-testid="scan-stop" onClick={stop} className="btn-outline flex-1 justify-center">■ Berhenti Kamera</button>
          )}
          <input 
            type="file" 
            accept="image/*" 
            id="qr-upload" 
            className="hidden" 
            onChange={handleFileUpload} 
          />
          <label htmlFor="qr-upload" className="btn-outline flex-1 justify-center cursor-pointer flex items-center text-center m-0">
            📁 Upload Gambar QR
          </label>
        </div>
      </div>

      <form onSubmit={submitManual} className="card">
        <label className="label">Input Manual (jika QR sulit dipindai)</label>
        <div className="flex gap-2">
          <input data-testid="scan-manual-input" className="input" value={manual} onChange={e => setManual(e.target.value)} placeholder="QURBAN|PN-XXX|token..." />
          <button data-testid="scan-manual-submit" className="btn-primary">Kirim</button>
        </div>
      </form>

      {lastResult && (
        <div className={`card ${lastResult.ok ? 'border-primary-500' : 'border-red-300'}`} data-testid="scan-result">
          <div className="text-sm text-slate-500">Hasil terakhir</div>
          {lastResult.ok ? (
            <div className="mt-2">
              <div className="text-lg font-bold text-primary-700">✓ Berhasil</div>
              <div className="text-sm">Penerima: <b>{lastResult.nama}</b> ({lastResult.kode})</div>
              <a
                href={sertifikatURL(lastResult.penerima_id)}
                target="_blank" rel="noreferrer"
                className="btn-primary mt-3 inline-flex"
                data-testid="scan-sertifikat-link"
              >📄 Unduh Sertifikat</a>
            </div>
          ) : (
            <div className="mt-2">
              <div className="text-lg font-bold text-red-600">✗ {lastResult.error}</div>
              {lastResult.nama && <div className="text-sm">Untuk: {lastResult.nama} ({lastResult.kode})</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
