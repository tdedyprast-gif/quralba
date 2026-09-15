import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@qurban.local')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Berhasil masuk')
      nav('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary-50 to-slate-100">
      <form onSubmit={submit} className="card w-full max-w-md" data-testid="login-form">
        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold text-primary-700">Sistem Qurban</div>
          <div className="text-sm text-slate-500 mt-1">Masuk sebagai panitia</div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input data-testid="login-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input data-testid="login-password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button data-testid="login-submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </div>
        <div className="mt-4 text-xs text-slate-500 text-center">Default: admin@qurban.local / admin123</div>
      </form>
    </div>
  )
}
