import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/paket', label: 'Paket Sapi', icon: '🐄' },
  { to: '/peserta', label: 'Peserta', icon: '👤' },
  { to: '/penerima', label: 'Penerima', icon: '📦' },
  { to: '/distribusi', label: 'Distribusi', icon: '📊' },
  { to: '/scan', label: 'Pemindai QR', icon: '📷' },
  { to: '/peta', label: 'Peta Distribusi', icon: '🗺️' },
  { to: '/laporan', label: 'Laporan', icon: '📄' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav_go = useNavigate()
  return (
    <div className="min-h-screen flex">
      <aside data-testid="sidebar" className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="text-xl font-extrabold text-primary-700">Qurban System</div>
          <div className="text-xs text-slate-500 mt-1">Panitia Idul Adha</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} end
              data-testid={`nav-${item.to.replace('/', '') || 'home'}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
                }`}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="text-sm font-semibold">{user?.email}</div>
          <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
          <button data-testid="logout-btn" onClick={() => { logout(); nav_go('/login') }} className="btn-outline w-full mt-3 text-sm">Keluar</button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
