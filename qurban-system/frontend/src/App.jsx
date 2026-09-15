import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Paket from './pages/Paket'
import Peserta from './pages/Peserta'
import Penerima from './pages/Penerima'
import Distribusi from './pages/Distribusi'
import QRScanner from './pages/QRScanner'
import Reports from './pages/Reports'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8">Memuat...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/paket" element={<Paket />} />
        <Route path="/peserta" element={<Peserta />} />
        <Route path="/penerima" element={<Penerima />} />
        <Route path="/distribusi" element={<Distribusi />} />
        <Route path="/scan" element={<QRScanner />} />
        <Route path="/laporan" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
