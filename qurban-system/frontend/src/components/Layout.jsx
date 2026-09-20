import { useState } from 'react'
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const items = NAV.filter(i => i.roles.includes(role))

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        data-testid="sidebar" 
        className={`fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <Link to="/" className="block" onClick={() => setIsSidebarOpen(false)}>
            <div className="text-xl font-extrabold text-primary-700">TPA Alba</div>
            <div className="text-xs text-slate-500 mt-1">Quralba</div>
          </Link>
          <button 
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg" 
            onClick={() => setIsSidebarOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map(item => (
            <NavLink key={item.to} to={item.to} end
              onClick={() => setIsSidebarOpen(false)}
              data-testid={`nav-${item.to.replace('/', '') || 'home'}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
                }`}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="text-sm font-semibold truncate">{user?.nama || user?.email}</div>
          <div className="text-xs text-slate-500">{ROLE_LABEL[role] || role}</div>
          <button data-testid="logout-btn" onClick={() => { logout(); nav_go('/login') }} className="btn-outline w-full mt-3 text-sm justify-center">Keluar</button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button 
            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            onClick={() => setIsSidebarOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-bold text-primary-700 truncate">Quralba</div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
