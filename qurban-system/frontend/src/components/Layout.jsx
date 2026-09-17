import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠', roles: ['admin', 'bendahara', 'pembagian'] },
  { to: '/validasi', label: 'Validasi Akun', icon: '✅', roles: ['admin'] },
  { to: '/bendahara', label: 'Bendahara', icon: '💰', roles: ['admin', 'bendahara'] },
  { to: '/peserta', label: 'Peserta', icon: '👤', roles: ['admin', 'bendahara'] },
  { to: '/pembagian', label: 'Pembagian', icon: '📦', roles: ['admin', 'pembagian'] },
  { to: '/scan', label: 'Pemindai QR', icon: '📷', roles: ['admin', 'pembagian'] },
  { to: '/peta', label: 'Peta Distribusi', icon: '🗺️', roles: ['admin', 'pembagian'] },
  { to: '/laporan', label: 'Laporan', icon: '📄', roles: ['admin', 'pembagian'] },
  { to: '/akun', label: 'Akun Saya', icon: '🪪', roles: ['peserta', 'penerima', 'admin', 'bendahara', 'pembagian'] },
]

const ROLE_LABEL = {
  admin: 'Administrator',
  bendahara: 'Panitia Bendahara',
  pembagian: 'Panitia Pembagian',
  peserta: 'Peserta Qurban',
  penerima: 'Penerima Daging',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const nav_go = useNavigate()
  const role = user?.role || ''

  const items = NAV.filter(i => i.roles.includes(role))

  return (
    <div className="min-h-screen flex">
      <aside data-testid="sidebar" className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <Link to="/" className="block">
            <div className="text-xl font-extrabold text-primary-700">TPA Alba</div>
            <div className="text-xs text-slate-500 mt-1">Quralba</div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map(item => (
            <NavLink key={item.to} to={item.to} end
              data-testid={`nav-${item.to.replace('/', '') || 'home'}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
                }`}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="text-sm font-semibold truncate">{user?.nama || user?.email}</div>
          <div className="text-xs text-slate-500">{ROLE_LABEL[role] || role}</div>
          <button data-testid="logout-btn" onClick={() => { logout(); nav_go('/login') }} className="btn-outline w-full mt-3 text-sm justify-center">Keluar</button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
