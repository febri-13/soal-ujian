"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, LockOpen, Users } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import Toast from "@/components/Toast"
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

      if (!matrixRows || matrixRows.length === 0) { setLoading(false); return }

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
          .map(g => g.profile_id === profileId ? { ...g, babs: g.babs.filter(b => b.bab_id_text !== babIdText) } : g)
          .filter(g => g.babs.length > 0)
      )
      showToast(`Bab "${babIdText}" dihapus`, "success")
    }
    setDeleting(null)
  }

  const handleDeleteGuru = async (profileId: string, nama: string) => {
    if (!confirm(`Hapus SEMUA matrix milik "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) return
    setDeleting(profileId)
    const { error } = await supabase.from("psat_matrix_input").delete().eq("profile_id", profileId)
    if (error) {
      showToast("Error: " + error.message, "error")
    } else {
      setGroups(prev => prev.filter(g => g.profile_id !== profileId))
      showToast(`Semua matrix ${nama} dihapus`, "success")
    }
    setDeleting(null)
  }

  const handleUnlockGuru = async (profileId: string, nama: string) => {
    if (!confirm(`Buka kunci edit matrix milik "${nama}"?`)) return
    setUnlocking(profileId)
    const { error } = await supabase
      .from("psat_matrix_input")
      .update({ is_submitted: false })
      .eq("profile_id", profileId)
    if (error) {
      showToast("Error: " + error.message, "error")
    } else {
      setGroups(prev => prev.map(g =>
        g.profile_id === profileId ? { ...g, babs: g.babs.map(b => ({ ...b, is_submitted: false })) } : g
      ))
      showToast(`Matrix ${nama} dibuka untuk diedit ulang`, "success")
    }
    setUnlocking(null)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--pp-bg)", minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="font-display text-xl" style={{ color: "var(--pp-ink-2)" }}>Memuat...</div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "var(--pp-bg)", minHeight: "100vh" }}>
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--pp-card)", borderBottom: "1.5px solid var(--pp-ink)" }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div style={{
              width: 40, height: 40, flexShrink: 0,
              backgroundColor: "var(--pp-primary)",
              border: "1.5px dashed rgba(255,255,255,0.45)",
              borderRadius: 12,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
              Kelola Matrix Guru
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 pb-1">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--pp-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-4 pb-12 space-y-4">
        {groups.length === 0 ? (
          <div
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "4px 4px 0 0 var(--pp-ink)",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div style={{
              width: 52, height: 52,
              backgroundColor: "var(--pp-bg)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 16,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Users className="w-6 h-6" style={{ color: "var(--pp-muted)" }} />
            </div>
            <p className="font-display font-semibold" style={{ color: "var(--pp-ink)" }}>Belum Ada Data Matrix</p>
            <p className="text-sm mt-1" style={{ color: "var(--pp-muted)" }}>Belum ada matrix yang dikirimkan oleh guru.</p>
          </div>
        ) : (
          groups.map(group => {
            const submittedCount = group.babs.filter(b => b.is_submitted).length
            return (
              <div
                key={group.profile_id}
                style={{
                  backgroundColor: "var(--pp-card)",
                  border: "1.5px solid var(--pp-ink)",
                  borderRadius: 22,
                  boxShadow: "4px 4px 0 0 var(--pp-ink)",
                  overflow: "hidden",
                }}
              >
                {/* Guru header band */}
                <div style={{
                  backgroundColor: "#FFF0E6",
                  borderBottom: "1.5px solid var(--pp-ink)",
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap" as const,
                }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div style={{
                      width: 38, height: 38, flexShrink: 0,
                      backgroundColor: "var(--pp-card)",
                      border: "1.5px solid var(--pp-ink)",
                      borderRadius: 10,
                      boxShadow: "2px 2px 0 0 var(--pp-ink)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span className="font-display font-bold text-sm" style={{ color: "#c2410c" }}>
                        {group.nama.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-sm" style={{ color: "var(--pp-ink)" }}>{group.nama}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--pp-muted)" }}>
                        {group.email}
                        <span
                          className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: "var(--pp-peach)", color: "#c2410c", border: "1px solid var(--pp-ink)" }}
                        >
                          {group.mapel_nama}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "var(--pp-mint)", color: "#15803d", border: "1.5px solid var(--pp-ink)" }}
                    >
                      {submittedCount}/{group.babs.length} submitted
                    </span>
                    {group.babs.some(b => b.is_submitted) && (
                      <button
                        onClick={() => handleUnlockGuru(group.profile_id, group.nama)}
                        disabled={unlocking === group.profile_id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--pp-lemon)",
                          color: "#92400e",
                          border: "1.5px solid var(--pp-ink)",
                          boxShadow: "2px 2px 0 0 var(--pp-ink)",
                        }}
                      >
                        <LockOpen className="w-3 h-3" />
                        Buka Kunci
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteGuru(group.profile_id, group.nama)}
                      disabled={deleting === group.profile_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--pp-pink)",
                        color: "#be123c",
                        border: "1.5px solid var(--pp-ink)",
                        boxShadow: "2px 2px 0 0 var(--pp-ink)",
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus Semua
                    </button>
                  </div>
                </div>

                {/* Bab list */}
                <div style={{ padding: "16px 20px" }} className="space-y-2">
                  {group.babs.map((bab, bi) => {
                    const key = `${bab.profile_id}:${bab.bab_id_text}`
                    return (
                      <div
                        key={bab.bab_id_text}
                        className="flex items-center justify-between px-4 py-2.5 rounded-[12px]"
                        style={{
                          backgroundColor: bi % 2 === 0 ? "var(--pp-bg)" : "var(--pp-card)",
                          border: "1.5px solid var(--pp-line)",
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: "var(--pp-lemon)", color: "var(--pp-ink)", border: "1px solid var(--pp-ink)" }}
                          >
                            {bi + 1}
                          </div>
                          <span className="text-sm font-medium" style={{ color: "var(--pp-ink)" }}>
                            {bab.bab_id_text}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              backgroundColor: bab.is_submitted ? "var(--pp-mint)" : "var(--pp-bg)",
                              color: bab.is_submitted ? "#15803d" : "var(--pp-muted)",
                              border: "1px solid var(--pp-line)",
                            }}
                          >
                            {bab.is_submitted ? "Submitted" : "Draft"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteBab(bab.profile_id, bab.bab_id_text)}
                          disabled={deleting === key}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-[8px] text-xs font-semibold disabled:opacity-50"
                          style={{
                            backgroundColor: "var(--pp-pink)",
                            color: "#be123c",
                            border: "1.5px solid var(--pp-ink)",
                            boxShadow: "1px 1px 0 0 var(--pp-ink)",
                          }}
                          title="Hapus bab ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
