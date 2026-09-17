import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
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
          <div className="text-3xl font-extrabold text-primary-700">TPA ALBA</div>
          <div className="text-sm text-slate-500 mt-1">Quralba</div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input data-testid="login-email" className="input" type="email" value="" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input data-testid="login-password" className="input" type="password" value="" required />
          </div>
          <button data-testid="login-submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </div>
        <div className="text-center text-sm text-slate-500 mt-5 pt-4 border-t border-slate-100">
          Belum punya akun?{' '}
          <Link to="/register" className="text-primary-700 font-semibold" data-testid="link-register">
            Daftar sebagai peserta / penerima
          </Link>
        </div>
      </form>
    </div>
  )
}
