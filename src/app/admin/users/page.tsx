"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"

const ROLE_OPTIONS = ["guru", "validator", "admin", "admin_keuangan"]

export default function UsersAdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userList, setUserList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

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
    const { data: users } = await supabase
      .from("profiles")
      .select("id,email,nama,username,role,created_at")
      .order("created_at", { ascending: false })

    if (users) {
      setUserList(users)
    }
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
      setUserList(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh)" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm hover:underline" style={{ color: "var(--color-muted-foreground)" }}>← Dashboard</a>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Kelola Users</h1>
          </div>
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