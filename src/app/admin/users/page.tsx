"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { UserPlus, X, Eye, EyeOff, Trash2, Pencil } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"

const ROLE_OPTIONS = ["guru", "validator", "admin", "admin_keuangan"]

const UNIT_OPTIONS = [
  "SMP I Al Abidin Surakarta",
  "SMP ABBS Surakarta",
  "SMPII Al Abidin Karanganyar",
  "SMPII Al Abidin Sukoharjo",
  "SMPII Al Abidin Klaten",
  "SMPII Al Abidin Boyolali",
  "SMPII Al Abidin Yogyakarta",
  "SMPII Al Abidin Salatiga",
]

const BANK_OPTIONS = ["CIMB", "MayBank"]

interface UserRow {
  id: string
  email: string
  nama: string | null
  role: string
  created_at: string
}

interface EditForm {
  userId: string
  email: string
  role: string
  nama: string
  noHp: string
  unitSekolah: string
  kelas: string
  mapelId: string
  bank: string
  noRekening: string
}

export default function UsersAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userList, setUserList] = useState<UserRow[]>([])
  const [mataPelajaran, setMataPelajaran] = useState<{ id: string; nama: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // Modal tambah user
  const [showAddModal, setShowAddModal] = useState(false)
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState("")
  const [formLoading, setFormLoading] = useState(false)

  // Modal edit profil
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .single()

      if (!profile || profile.role !== "admin") {
        setToast({ message: "Akses ditolak", type: "error" })
        setTimeout(() => router.push("/dashboard"), 1500)
        return
      }

      setUser(u)

      const { data: mapelData } = await supabase
        .from("mata_pelajaran")
        .select("id, nama")
        .order("nama")
      if (mapelData) setMataPelajaran(mapelData)

      loadUsers()
    }
    load()
  }, [router])

  const loadUsers = async () => {
    setLoading(true)
    setLoadError("")
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id,email,nama,role,created_at")
      .order("created_at", { ascending: false })

    if (error) setLoadError(error.message)
    else setUserList(users ?? [])
    setLoading(false)
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId)
    setSaving(false)
    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Role diperbarui!", type: "success" })
      setUserList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  const openEditModal = async (u: UserRow) => {
    setShowEditModal(true)
    setEditLoading(true)
    setEditForm({
      userId: u.id,
      email: u.email,
      role: u.role,
      nama: u.nama || "",
      noHp: "",
      unitSekolah: "",
      kelas: "",
      mapelId: "",
      bank: "",
      noRekening: "",
    })

    // Load detail profil
    const { data: profileData } = await supabase
      .from("profiles")
      .select("nama, no_hp, kelas, role")
      .eq("id", u.id)
      .maybeSingle()

    const { data: guruData } = await supabase
      .from("psat_guru_data")
      .select("whatsapp, unit_sekolah, mapel_id, bank, no_rekening")
      .eq("profile_id", u.id)
      .maybeSingle()

    setEditForm({
      userId: u.id,
      email: u.email,
      role: profileData?.role || u.role,
      nama: profileData?.nama || u.nama || "",
      noHp: guruData?.whatsapp || profileData?.no_hp || "",
      unitSekolah: guruData?.unit_sekolah || "",
      kelas: profileData?.kelas || "",
      mapelId: guruData?.mapel_id || "",
      bank: guruData?.bank || "",
      noRekening: guruData?.no_rekening || "",
    })
    setEditLoading(false)
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    setEditSaving(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setToast({ message: "Sesi tidak valid, silakan login ulang.", type: "error" })
      setEditSaving(false)
      return
    }

    const isGuru = editForm.role === "guru"

    const res = await fetch("/api/admin/update-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: editForm.userId,
        profileData: {
          nama: editForm.nama,
          no_hp: editForm.noHp,
          role: editForm.role,
          kelas: isGuru ? editForm.kelas : null,
        },
        guruData: {
          no_hp: editForm.noHp,
          unit_sekolah: editForm.unitSekolah,
          bank: editForm.bank,
          no_rekening: editForm.noRekening,
          mapel_id: isGuru ? (editForm.mapelId || null) : null,
        },
      }),
    })

    const result = await res.json()
    setEditSaving(false)

    if (!res.ok) {
      setToast({ message: result.error || "Gagal menyimpan profil.", type: "error" })
      return
    }

    setToast({ message: "Profil berhasil diperbarui!", type: "success" })
    setShowEditModal(false)
    setUserList(prev => prev.map(u =>
      u.id === editForm.userId ? { ...u, nama: editForm.nama, role: editForm.role } : u
    ))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const selectable = userList.filter(u => u.id !== user?.id).map(u => u.id)
    if (selectable.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectable))
    }
  }

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Hapus ${ids.length} user? Tindakan ini tidak bisa dibatalkan.`)) return
    setDeleting(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setToast({ message: "Sesi tidak valid, silakan login ulang.", type: "error" })
      setDeleting(false)
      return
    }

    const res = await fetch("/api/admin/delete-user", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ userIds: ids }),
    })

    const result = await res.json()
    setDeleting(false)

    if (!res.ok) {
      setToast({ message: result.error || "Gagal menghapus user.", type: "error" })
      return
    }

    setToast({ message: `${result.deleted} user berhasil dihapus.`, type: "success" })
    setSelectedIds(new Set())
    loadUsers()
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError("")

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setFormError("Sesi tidak valid."); setFormLoading(false); return }

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: formEmail, password: formPassword }),
    })

    const result = await res.json()
    setFormLoading(false)

    if (!res.ok) { setFormError(result.error || "Gagal membuat user."); return }

    setToast({ message: "User berhasil ditambahkan!", type: "success" })
    setShowAddModal(false)
    setFormEmail(""); setFormPassword(""); setShowPassword(false); setFormError("")
    loadUsers()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--color-muted-foreground)" }}>Memuat...</div>
  }

  const editIsGuru = editForm?.role === "guru"

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm hover:underline" style={{ color: "var(--color-muted-foreground)" }}>← Dashboard</a>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Kelola Users</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {selectedIds.size > 0 && (
              <button
                onClick={() => handleDelete([...selectedIds])}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
              >
                <Trash2 className="w-4 h-4" />
                Hapus Terpilih ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              <UserPlus className="w-4 h-4" />
              Tambah User
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <table className="w-full">
            <thead className="border-b" style={{ backgroundColor: "var(--color-muted)", borderColor: "var(--color-border)" }}>
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={
                      userList.filter(u => u.id !== user?.id).length > 0 &&
                      userList.filter(u => u.id !== user?.id).every(u => selectedIds.has(u.id))
                    }
                  />
                </th>
                <th className="text-left p-3 text-sm font-medium">Nama / Email</th>
                <th className="text-left p-3 text-sm font-medium">Role</th>
                <th className="text-left p-3 text-sm font-medium">Bergabung</th>
                <th className="text-left p-3 text-sm font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {loadError ? (
                <tr><td colSpan={5} className="p-4 text-sm text-center" style={{ color: "#dc2626" }}>Error: {loadError}</td></tr>
              ) : userList.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-sm text-center" style={{ color: "var(--color-muted-foreground)" }}>Belum ada user.</td></tr>
              ) : null}
              {userList.map(u => {
                const isSelf = u.id === user?.id
                return (
                  <tr key={u.id}>
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} disabled={isSelf} />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-sm" style={{ color: "var(--color-foreground)" }}>{u.nama || <span style={{ color: "var(--color-muted-foreground)" }}>Belum diisi</span>}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>{u.email}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        u.role === "admin" ? "bg-purple-600 text-white" :
                        u.role === "validator" ? "bg-blue-600 text-white" :
                        u.role === "admin_keuangan" ? "bg-orange-600 text-white" :
                        "bg-gray-500 text-white"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                      {new Date(u.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          disabled={saving || isSelf}
                          className="p-1 rounded border text-xs"
                          style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                        >
                          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded border"
                          style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          title="Edit profil"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => handleDelete([u.id])}
                            disabled={deleting}
                            className="p-1.5 rounded disabled:opacity-50"
                            style={{ color: "#dc2626" }}
                            title="Hapus user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Edit Profil */}
      {showEditModal && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border shadow-xl overflow-y-auto max-h-[90vh]"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
              <div>
                <h2 className="font-semibold text-base" style={{ color: "var(--color-foreground)" }}>Edit Profil</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>{editForm.email}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ color: "var(--color-muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {editLoading ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>Memuat data...</div>
            ) : (
              <form onSubmit={handleEditSave} className="p-5 space-y-4">

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm(f => f ? { ...f, role: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-md border text-sm"
                    style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  >
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Nama */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nama Lengkap</label>
                  <input
                    type="text"
                    value={editForm.nama}
                    onChange={e => setEditForm(f => f ? { ...f, nama: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-md border text-sm"
                    style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  />
                </div>

                {/* No HP */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nomor HP</label>
                  <input
                    type="tel"
                    value={editForm.noHp}
                    onChange={e => setEditForm(f => f ? { ...f, noHp: e.target.value } : f)}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 rounded-md border text-sm"
                    style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  />
                </div>

                {/* Unit Sekolah */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Unit Sekolah</label>
                  <select
                    value={editForm.unitSekolah}
                    onChange={e => setEditForm(f => f ? { ...f, unitSekolah: e.target.value } : f)}
                    className="w-full px-3 py-2 rounded-md border text-sm"
                    style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  >
                    <option value="">Pilih Unit Sekolah</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* Kelas & Mapel — hanya untuk guru */}
                {editIsGuru && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Kelas</label>
                      <select
                        value={editForm.kelas}
                        onChange={e => setEditForm(f => f ? { ...f, kelas: e.target.value } : f)}
                        className="w-full px-3 py-2 rounded-md border text-sm"
                        style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                      >
                        <option value="">Pilih Kelas</option>
                        <option value="7">Kelas 7</option>
                        <option value="8">Kelas 8</option>
                        <option value="9">Kelas 9</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Mata Pelajaran</label>
                      <select
                        value={editForm.mapelId}
                        onChange={e => setEditForm(f => f ? { ...f, mapelId: e.target.value } : f)}
                        className="w-full px-3 py-2 rounded-md border text-sm"
                        style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                      >
                        <option value="">Pilih Mata Pelajaran</option>
                        {mataPelajaran.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* Bank & Rekening */}
                <div className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <p className="text-sm font-semibold mb-3 mt-3" style={{ color: "var(--color-foreground)" }}>Data Rekening</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Bank</label>
                      <select
                        value={editForm.bank}
                        onChange={e => setEditForm(f => f ? { ...f, bank: e.target.value } : f)}
                        className="w-full px-3 py-2 rounded-md border text-sm"
                        style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                      >
                        <option value="">Pilih Bank</option>
                        {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nomor Rekening</label>
                      <input
                        type="text"
                        value={editForm.noRekening}
                        onChange={e => setEditForm(f => f ? { ...f, noRekening: e.target.value } : f)}
                        className="w-full px-3 py-2 rounded-md border text-sm"
                        style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2 px-4 rounded-md text-sm font-medium border"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="flex-1 py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                  >
                    {editSaving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah User */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border shadow-xl"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
              <h2 className="font-semibold text-base" style={{ color: "var(--color-foreground)" }}>Tambah User</h2>
              <button onClick={() => setShowAddModal(false)} style={{ color: "var(--color-muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border text-sm"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  autoComplete="off"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-9 rounded-md border text-sm"
                    style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Minimal 6 karakter.</p>
              </div>

              {formError && <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{formError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 px-4 rounded-md text-sm font-medium border"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                >
                  {formLoading ? "Membuat..." : "Tambah User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
