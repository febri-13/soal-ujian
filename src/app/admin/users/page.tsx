"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { UserPlus, X, Eye, EyeOff } from "lucide-react"

const ROLE_OPTIONS = ["guru", "validator", "admin", "admin_keuangan"]

export default function UsersAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userList, setUserList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState("")
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }

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
      setToast({ message: "Role updated!", type: "success" })
      setUserList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  const resetForm = () => {
    setFormEmail("")
    setFormPassword("")
    setShowPassword(false)
    setFormError("")
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError("")

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setFormError("Sesi tidak valid, silakan login ulang.")
      setFormLoading(false)
      return
    }

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: formEmail, password: formPassword }),
    })

    const result = await res.json()
    setFormLoading(false)

    if (!res.ok) {
      setFormError(result.error || "Gagal membuat user.")
      return
    }

    setToast({ message: "User berhasil ditambahkan!", type: "success" })
    setShowModal(false)
    resetForm()
    loadUsers()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm hover:underline" style={{ color: "var(--color-muted-foreground)" }}>← Dashboard</a>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Kelola Users</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            <UserPlus className="w-4 h-4" />
            Tambah User
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <table className="w-full">
            <thead className="border-b" style={{ backgroundColor: "var(--color-muted)", borderColor: "var(--color-border)" }}>
              <tr>
                <th className="text-left p-3 text-sm font-medium">Nama/Email</th>
                <th className="text-left p-3 text-sm font-medium">Role</th>
                <th className="text-left p-3 text-sm font-medium">Bergabung</th>
                <th className="text-left p-3 text-sm font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {loadError ? (
                <tr><td colSpan={4} className="p-4 text-sm text-center" style={{ color: "#dc2626" }}>Error: {loadError}</td></tr>
              ) : userList.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-sm text-center" style={{ color: "var(--color-muted-foreground)" }}>Belum ada user.</td></tr>
              ) : null}
              {userList.map(u => (
                <tr key={u.id}>
                  <td className="p-3">
                    <div className="font-medium">{u.nama || "-"}</div>
                    <div className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs rounded ${
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
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={saving || u.id === user?.id}
                      className="p-1 rounded border text-sm"
                      style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => { setShowModal(false); resetForm() }}
        >
          <div
            className="w-full max-w-md rounded-lg border shadow-xl overflow-y-auto max-h-[90vh]"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
              <h2 className="font-semibold text-base" style={{ color: "var(--color-foreground)" }}>Tambah User</h2>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{ color: "var(--color-muted-foreground)" }}>
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

              {formError && (
                <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{formError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
