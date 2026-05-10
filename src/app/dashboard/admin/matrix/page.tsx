"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, LockOpen } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import { supabase } from "@/lib/supabase"

interface MatrixBab {
  profile_id: string
  bab_id_text: string
  is_submitted: boolean
}

interface GuruGroup {
  profile_id: string
  nama: string
  email: string
  mapel_nama: string
  babs: MatrixBab[]
}

export default function AdminMatrixPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<GuruGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data: matrixRows } = await supabase
        .from("psat_matrix_input")
        .select("profile_id, mapel_id, bab_id_text, is_submitted")
        .order("profile_id")

      if (!matrixRows || matrixRows.length === 0) {
        setLoading(false)
        return
      }

      const profileIds = [...new Set(matrixRows.map(r => r.profile_id))]
      const mapelIds = [...new Set(matrixRows.map(r => r.mapel_id).filter(Boolean))] as string[]

      const [{ data: profiles }, { data: mapels }] = await Promise.all([
        supabase.from("profiles").select("id, nama, email").in("id", profileIds),
        supabase.from("mata_pelajaran").select("id, nama").in("id", mapelIds),
      ])

      const profileMap: Record<string, { nama: string; email: string }> = {}
      profiles?.forEach(p => { profileMap[p.id] = { nama: p.nama || p.email || "Unknown", email: p.email || "" } })

      const mapelMap: Record<string, string> = {}
      mapels?.forEach(m => { mapelMap[m.id] = m.nama })

      const groupMap: Record<string, GuruGroup> = {}
      matrixRows.forEach(row => {
        if (!groupMap[row.profile_id]) {
          const profile = profileMap[row.profile_id] || { nama: "Unknown", email: "" }
          groupMap[row.profile_id] = {
            profile_id: row.profile_id,
            nama: profile.nama,
            email: profile.email,
            mapel_nama: row.mapel_id ? (mapelMap[row.mapel_id] || "-") : "-",
            babs: [],
          }
        }
        groupMap[row.profile_id].babs.push({
          profile_id: row.profile_id,
          bab_id_text: row.bab_id_text,
          is_submitted: row.is_submitted,
        })
      })

      setGroups(Object.values(groupMap))
      setLoading(false)
    }
    load()
  }, [router])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleDeleteBab = async (profileId: string, babIdText: string) => {
    if (!confirm(`Hapus bab "${babIdText}"?`)) return
    const key = `${profileId}:${babIdText}`
    setDeleting(key)

    const { error } = await supabase
      .from("psat_matrix_input")
      .delete()
      .eq("profile_id", profileId)
      .eq("bab_id_text", babIdText)

    if (error) {
      showToast("Error: " + error.message, "error")
    } else {
      setGroups(prev =>
        prev
          .map(g =>
            g.profile_id === profileId
              ? { ...g, babs: g.babs.filter(b => b.bab_id_text !== babIdText) }
              : g
          )
          .filter(g => g.babs.length > 0)
      )
      showToast(`Bab "${babIdText}" dihapus`, "success")
    }
    setDeleting(null)
  }

  const handleDeleteGuru = async (profileId: string, nama: string) => {
    if (!confirm(`Hapus SEMUA matrix milik "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) return
    setDeleting(profileId)

    const { error } = await supabase
      .from("psat_matrix_input")
      .delete()
      .eq("profile_id", profileId)

    if (error) {
      showToast("Error: " + error.message, "error")
    } else {
      setGroups(prev => prev.filter(g => g.profile_id !== profileId))
      showToast(`Semua matrix ${nama} dihapus`, "success")
    }
    setDeleting(null)
  }

  const handleUnlockGuru = async (profileId: string, nama: string) => {
    if (!confirm(`Buka kunci edit matrix milik "${nama}"? Guru akan bisa mengedit ulang matrixnya.`)) return
    setUnlocking(profileId)

    const { error } = await supabase
      .from("psat_matrix_input")
      .update({ is_submitted: false })
      .eq("profile_id", profileId)

    if (error) {
      showToast("Error: " + error.message, "error")
    } else {
      setGroups(prev => prev.map(g =>
        g.profile_id === profileId
          ? { ...g, babs: g.babs.map(b => ({ ...b, is_submitted: false })) }
          : g
      ))
      showToast(`Matrix ${nama} dibuka untuk diedit ulang`, "success")
    }
    setUnlocking(null)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="sticky top-0 z-10" style={{ backgroundColor: "var(--psat-primary)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100"
              style={{ color: "var(--psat-primary-fg)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--psat-primary-fg)" }}>
              Admin — Kelola Matrix Guru
            </h1>
          </div>
          <div className="[&_button]:bg-transparent [&_button]:border-white/30 [&_button]:text-white">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4">
        {groups.length === 0 ? (
          <div className="rounded-lg p-8 border text-center" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <p style={{ color: "var(--color-muted-foreground)" }}>Belum ada data matrix dari guru.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.profile_id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                {/* Header guru */}
                <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>{group.nama}</p>
                    <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      {group.email} · {group.mapel_nama}
                    </p>
                  </div>
                  {group.babs.some(b => b.is_submitted) && (
                    <button
                      onClick={() => handleUnlockGuru(group.profile_id, group.nama)}
                      disabled={unlocking === group.profile_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border disabled:opacity-50"
                      style={{ backgroundColor: "#fffbeb", color: "#d97706", borderColor: "#fcd34d" }}
                    >
                      <LockOpen className="w-3 h-3" />
                      Buka Kunci Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteGuru(group.profile_id, group.nama)}
                    disabled={deleting === group.profile_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border disabled:opacity-50"
                    style={{ backgroundColor: "#fef2f2", color: "#dc2626", borderColor: "#fca5a5" }}
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Semua
                  </button>
                </div>

                {/* List bab */}
                <div className="p-4 space-y-2">
                  {group.babs.map(bab => {
                    const key = `${bab.profile_id}:${bab.bab_id_text}`
                    return (
                      <div
                        key={bab.bab_id_text}
                        className="flex items-center justify-between px-3 py-2 rounded border"
                        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                            {bab.bab_id_text}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: bab.is_submitted ? "#dcfce7" : "var(--color-muted)",
                              color: bab.is_submitted ? "#15803d" : "var(--color-muted-foreground)",
                            }}
                          >
                            {bab.is_submitted ? "Submitted" : "Draft"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteBab(bab.profile_id, bab.bab_id_text)}
                          disabled={deleting === key}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-50 hover:bg-red-50"
                          style={{ color: "#dc2626" }}
                          title="Hapus bab ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div
          className="fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50"
          style={{ backgroundColor: toast.type === "success" ? "#22c55e" : "#ef4444" }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
