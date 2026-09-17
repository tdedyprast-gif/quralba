import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Paket from './pages/Paket'
import Peserta from './pages/Peserta'
import Penerima from './pages/Penerima'
import Distribusi from './pages/Distribusi'
import QRScanner from './pages/QRScanner'
import Reports from './pages/Reports'
import Peta from './pages/Peta'
import ValidasiUser from './pages/ValidasiUser'
import Bendahara from './pages/Bendahara'
import Pembagian from './pages/Pembagian'
import AkunSaya from './pages/AkunSaya'

// Halaman default per role
function Home() {
  const { user } = useAuth()
  const role = user?.role
  if (role === 'peserta' || role === 'penerima') return <Navigate to="/akun" replace />
  return <Dashboard />
}

function Protected({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8">Memuat...</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Home />} />
        <Route path="/akun" element={<AkunSaya />} />

        <Route path="/validasi" element={<Protected roles={['admin']}><ValidasiUser /></Protected>} />

        <Route path="/bendahara" element={<Protected roles={['admin', 'bendahara']}><Bendahara /></Protected>} />
        <Route path="/paket" element={<Protected roles={['admin', 'bendahara']}><Paket /></Protected>} />
        <Route path="/peserta" element={<Protected roles={['admin', 'bendahara']}><Peserta /></Protected>} />

        <Route path="/pembagian" element={<Protected roles={['admin', 'pembagian']}><Pembagian /></Protected>} />
        <Route path="/penerima" element={<Protected roles={['admin', 'pembagian']}><Penerima /></Protected>} />
        <Route path="/distribusi" element={<Protected roles={['admin', 'pembagian']}><Distribusi /></Protected>} />
        <Route path="/scan" element={<Protected roles={['admin', 'pembagian']}><QRScanner /></Protected>} />
        <Route path="/peta" element={<Protected roles={['admin', 'pembagian']}><Peta /></Protected>} />
        <Route path="/laporan" element={<Protected roles={['admin', 'pembagian']}><Reports /></Protected>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
