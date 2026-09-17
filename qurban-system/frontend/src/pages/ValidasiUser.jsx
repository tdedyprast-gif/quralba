import { useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

// Pilihan role: panitia (admin/bendahara/pembagian) + peserta/penerima
const ROLE_GROUPS = [
  {
    label: 'Panitia',
    options: [
      { value: 'admin', label: 'Admin (Super User)' },
      { value: 'bendahara', label: 'Panitia Bendahara' },
      { value: 'pembagian', label: 'Panitia Distribusi (Pembagian)' },
    ],
  },
  {
    label: 'Peserta / Penerima',
    options: [
      { value: 'peserta', label: 'Peserta Qurban' },
      { value: 'penerima', label: 'Penerima Daging' },
    ],
  },
]

const ROLE_LABEL = {}
ROLE_GROUPS.forEach(g => g.options.forEach(o => { ROLE_LABEL[o.value] = o.label }))

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Aktif' },
  { value: 'rejected', label: 'Ditolak' },
]

const FILTERS = [
  { value: 'pending', label: 'Menunggu Validasi' },
  { value: 'active', label: 'Aktif' },
  { value: 'rejected', label: 'Ditolak' },
  { value: '', label: 'Semua' },
]

function RoleSelect({ value, onChange, testid, size = 'sm' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      data-testid={testid}
      className={`rounded-lg border border-slate-300 bg-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 ${
        size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-2 w-full'
      }`}
    >
      {ROLE_GROUPS.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

export default function ValidasiUser() {
  const [filter, setFilter] = useState('pending')
  const [roleFilter, setRoleFilter] = useState('')
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      if (roleFilter) params.set('role', roleFilter)
      const qs = params.toString()
      const [r1, r2] = await Promise.all([
        api.get(`/api/admin/users${qs ? '?' + qs : ''}`),
        api.get('/api/admin/stats'),
      ])
      setItems(r1.data || [])
      setStats(r2.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter, roleFilter])

  const approve = async (u) => {
    try {
      const r = await api.post(`/api/admin/users/${u.id}/approve`)
      const extra = r.data.peserta_id ? ' Data peserta dibuat.' : r.data.penerima_id ? ' Data penerima dibuat.' : ''
      toast.success(`Akun ${u.nama} diaktifkan.${extra}`)
      // paket pilihan pendaftar penuh → paket tidak ditetapkan, peserta pilih sendiri
      if (r.data.peringatan) toast(r.data.peringatan, { icon: '⚠️', duration: 7000 })
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menyetujui') }
  }

  const doReject = async () => {
    if (!rejecting) return
    try {
      await api.post(`/api/admin/users/${rejecting.id}/reject`, { reason })
      toast.success('Pendaftaran ditolak')
      setRejecting(null); setReason(''); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menolak') }
  }

  // Ganti role langsung dari tabel
  const changeRole = async (u, role) => {
    if (role === u.role) return
    try {
      await api.put(`/api/admin/users/${u.id}`, {
        nama: u.nama, email: u.email, no_hp: u.no_hp || '', alamat: u.alamat || '',
        role, status: u.status,
      })
      toast.success(`Role ${u.nama} diubah ke ${ROLE_LABEL[role] || role}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengubah role')
      load()
    }
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await api.put(`/api/admin/users/${editing.id}`, {
        nama: editing.nama, email: editing.email, no_hp: editing.no_hp || '',
        alamat: editing.alamat || '', role: editing.role, status: editing.status,
      })
      toast.success('Data akun diperbarui')
      setEditing(null); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  const saveCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/api/admin/users', creating)
      toast.success('Akun baru dibuat')
      setCreating(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal membuat akun') }
    finally { setSaving(false) }
  }

  const roleBadge = (role) => ({
    peserta: 'bg-blue-100 text-blue-700',
    penerima: 'bg-amber-100 text-amber-700',
    admin: 'bg-purple-100 text-purple-700',
    bendahara: 'bg-green-100 text-green-700',
    pembagian: 'bg-teal-100 text-teal-700',
  }[role] || 'bg-slate-100 text-slate-700')

  const statusBadge = (s) => ({
    pending: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }[s] || 'bg-slate-100 text-slate-700')

  return (
    <div className="space-y-6" data-testid="validasi-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Validasi &amp; Kelola Akun</h1>
          <p className="text-sm text-slate-500">
            Setujui pendaftaran, ubah role panitia, dan perbarui data akun.
          </p>
        </div>
        <button onClick={() => setCreating({
          nama: '', email: '', password: '', no_hp: '', alamat: '',
          role: 'bendahara', status: 'active',
        })} className="btn-primary" data-testid="btn-tambah-akun">
          + Tambah Akun
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Menunggu Validasi</div>
          <div className="text-3xl font-extrabold mt-1 text-amber-600">{stats?.pending ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Akun Aktif</div>
          <div className="text-3xl font-extrabold mt-1 text-primary-700">{stats?.active ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Ditolak</div>
          <div className="text-3xl font-extrabold mt-1 text-red-600">{stats?.rejected ?? '-'}</div>
        </div>
      </div>

      {stats?.by_role && (
        <div className="card">
          <div className="font-bold text-sm mb-3">Sebaran per Role</div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.by_role).map(([role, n]) => (
              <span key={role} className={`badge ${roleBadge(role)}`}>
                {ROLE_LABEL[role] || role}: {n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            data-testid={`filter-${f.value || 'all'}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              filter === f.value ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} data-testid="filter-role">
            <option value="">Semua role</option>
            {ROLE_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="py-2">Nama / Email</th>
              <th>Role</th>
              <th>Kontak</th>
              <th>Alamat</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map(u => (
              <tr key={u.id} className="border-t border-slate-100 align-top">
                <td className="py-3">
                  <div className="font-semibold">{u.nama}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  {(u.peserta_id || u.penerima_id) && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      tertaut: {u.peserta_id ? 'data peserta' : 'data penerima'}
                    </div>
                  )}
                </td>
                <td>
                  <RoleSelect value={u.role} onChange={(v) => changeRole(u, v)}
                    testid={`role-select-${u.id}`} />
                </td>
                <td className="text-xs">{u.no_hp || '-'}</td>
                <td className="text-xs max-w-[180px]">{u.alamat || '-'}</td>
                <td>
                  <span className={`badge ${statusBadge(u.status)}`}>{u.status}</span>
                  {u.status === 'rejected' && u.reject_reason && (
                    <div className="text-xs text-red-600 mt-1">{u.reject_reason}</div>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">
                  {u.status === 'pending' && (
                    <>
                      <button onClick={() => approve(u)} className="btn-primary text-xs"
                        data-testid={`approve-${u.id}`}>Setujui</button>
                      <button onClick={() => { setRejecting(u); setReason('') }}
                        className="btn-outline text-xs ml-2" data-testid={`reject-${u.id}`}>Tolak</button>
                    </>
                  )}
                  {u.status === 'rejected' && (
                    <button onClick={() => approve(u)} className="btn-outline text-xs mr-2">Aktifkan</button>
                  )}
                  <button onClick={() => setEditing({ ...u, no_hp: u.no_hp || '', alamat: u.alamat || '' })}
                    className="text-primary-700 text-xs font-semibold ml-2" data-testid={`edit-${u.id}`}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">Tidak ada data pada filter ini.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">Memuat…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50 overflow-auto">
          <form onSubmit={saveEdit} className="card w-full max-w-lg my-8" data-testid="edit-modal">
            <div className="font-bold mb-4">Edit Akun</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Nama Lengkap *</label>
                <input required className="input" value={editing.nama}
                  onChange={e => setEditing({ ...editing, nama: e.target.value })} data-testid="edit-nama" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Email *</label>
                <input required type="email" className="input" value={editing.email}
                  onChange={e => setEditing({ ...editing, email: e.target.value })} data-testid="edit-email" />
              </div>
              <div>
                <label className="label">No. HP</label>
                <input className="input" value={editing.no_hp}
                  onChange={e => setEditing({ ...editing, no_hp: e.target.value })} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editing.status}
                  onChange={e => setEditing({ ...editing, status: e.target.value })} data-testid="edit-status">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Role</label>
                <RoleSelect value={editing.role} size="lg"
                  onChange={(v) => setEditing({ ...editing, role: v })} testid="edit-role" />
                <p className="text-xs text-slate-400 mt-1">
                  Mengubah role ke peserta/penerima akan otomatis menyiapkan data terkait. Role panitia akan melepas tautan data.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="label">Alamat</label>
                <input className="input" value={editing.alamat}
                  onChange={e => setEditing({ ...editing, alamat: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button type="button" onClick={() => setEditing(null)} className="btn-outline">Batal</button>
              <button disabled={saving} className="btn-primary" data-testid="edit-save">
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50 overflow-auto">
          <form onSubmit={saveCreate} className="card w-full max-w-lg my-8" data-testid="create-modal">
            <div className="font-bold mb-1">Tambah Akun Baru</div>
            <p className="text-xs text-slate-500 mb-4">
              Untuk akun panitia (admin/bendahara/pembagian) yang tidak bisa mendaftar sendiri.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Nama Lengkap *</label>
                <input required className="input" value={creating.nama}
                  onChange={e => setCreating({ ...creating, nama: e.target.value })} data-testid="create-nama" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input required type="email" className="input" value={creating.email}
                  onChange={e => setCreating({ ...creating, email: e.target.value })} data-testid="create-email" />
              </div>
              <div>
                <label className="label">Password * <span className="text-xs text-slate-400">(min. 6)</span></label>
                <input required type="password" minLength={6} className="input" value={creating.password}
                  onChange={e => setCreating({ ...creating, password: e.target.value })} data-testid="create-password" />
              </div>
              <div>
                <label className="label">Role</label>
                <RoleSelect value={creating.role} size="lg"
                  onChange={(v) => setCreating({ ...creating, role: v })} testid="create-role" />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={creating.status}
                  onChange={e => setCreating({ ...creating, status: e.target.value })} data-testid="create-status">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">No. HP</label>
                <input className="input" value={creating.no_hp}
                  onChange={e => setCreating({ ...creating, no_hp: e.target.value })} />
              </div>
              <div>
                <label className="label">Alamat</label>
                <input className="input" value={creating.alamat}
                  onChange={e => setCreating({ ...creating, alamat: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button type="button" onClick={() => setCreating(false)} className="btn-outline">Batal</button>
              <button disabled={saving} className="btn-primary" data-testid="create-save">
                {saving ? 'Menyimpan…' : 'Buat Akun'}
              </button>
            </div>
          </form>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
          <div className="card w-full max-w-md" data-testid="reject-modal">
            <div className="font-bold mb-1">Tolak Pendaftaran</div>
            <div className="text-sm text-slate-500 mb-3">{rejecting.nama} — {rejecting.email}</div>
            <label className="label">Alasan penolakan</label>
            <textarea className="input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Contoh: data tidak lengkap / bukan warga lingkungan" />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setRejecting(null)} className="btn-outline">Batal</button>
              <button onClick={doReject} className="btn-primary" data-testid="reject-confirm">Tolak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
