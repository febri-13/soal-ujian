"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { CheckCircle, Clock, AlertCircle, ChevronLeft } from "lucide-react"

interface MapelSummary {
  id: string
  nama: string
  kode: string | null
  submitted: number
  needs_revision: number
  approved: number
}

export default function ValidasiPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mapelSummaries, setMapelSummaries] = useState<MapelSummary[]>([])
  const [selectedMapel, setSelectedMapel] = useState<MapelSummary | null>(null)
  const [soalList, setSoalList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSoal, setLoadingSoal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, nama")
        .eq("id", u.id)
        .single()

      if (!profile || !["admin", "validator"].includes(profile.role)) {
        setToast({ message: "Akses ditolak", type: "error" })
        setTimeout(() => router.push("/dashboard"), 1500)
        return
      }

      setUser({ ...u, nama: profile.nama })

      // Load semua mapel + hitung soal per status
      const { data: mapelList } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama", { ascending: true })

      const { data: soalCounts } = await supabase
        .from("bank_soal")
        .select("mata_pelajaran_id, status")
        .in("status", ["submitted", "needs_revision", "approved"])

      if (mapelList && soalCounts) {
        const summaries: MapelSummary[] = mapelList.map(m => ({
          id: m.id,
          nama: m.nama,
          kode: m.kode,
          submitted: soalCounts.filter(s => s.mata_pelajaran_id === m.id && s.status === "submitted").length,
          needs_revision: soalCounts.filter(s => s.mata_pelajaran_id === m.id && s.status === "needs_revision").length,
          approved: soalCounts.filter(s => s.mata_pelajaran_id === m.id && s.status === "approved").length,
        })).filter(m => m.submitted + m.needs_revision + m.approved > 0)

        setMapelSummaries(summaries)

        // Jika dari dashboard ada selectedMapelId
        const savedMapelId = localStorage.getItem("selectedMapelId")
        if (savedMapelId) {
          localStorage.removeItem("selectedMapelId")
          const found = summaries.find(m => m.id === savedMapelId)
          if (found) openMapel(found)
        }
      }

      setLoading(false)
    }
    load()
  }, [router])

  const openMapel = async (mapel: MapelSummary) => {
    setSelectedMapel(mapel)
    setLoadingSoal(true)
    setSoalList([])
    setRevisionNotes({})

    const { data: soal } = await supabase
      .from("bank_soal")
      .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar,status,revision_notes,revision_history,guru_id")
      .eq("mata_pelajaran_id", mapel.id)
      .in("status", ["submitted", "needs_revision", "approved"])
      .order("created_at", { ascending: true })

    if (soal) setSoalList(soal)
    setLoadingSoal(false)
  }

  const handleStatusChange = async (soalId: string, newStatus: string) => {
    setSaving(true)
    const notes = revisionNotes[soalId] || ""
    const validatorName = user?.nama || "Validator"
    const fullNotes = newStatus === "approved"
      ? `[${validatorName}] Approved`
      : notes ? `[${validatorName}] ${notes}` : `[${validatorName}] Review`

    const currentSoal = soalList.find(s => s.id === soalId)
    const newHistory = [...(currentSoal?.revision_history || []), fullNotes]

    const { error } = await supabase
      .from("bank_soal")
      .update({ status: newStatus, revision_notes: fullNotes, revision_history: newHistory, updated_at: new Date().toISOString() })
      .eq("id", soalId)

    setSaving(false)

    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Status diperbarui!", type: "success" })
      setSoalList(prev => prev.map(s =>
        s.id === soalId ? { ...s, status: newStatus, revision_notes: fullNotes, revision_history: newHistory } : s
      ))
      // Update summary count
      setMapelSummaries(prev => prev.map(m => {
        if (m.id !== selectedMapel?.id) return m
        const old = soalList.find(s => s.id === soalId)
        if (!old) return m
        const dec = (k: keyof MapelSummary) => Math.max(0, (m[k] as number) - 1)
        const inc = (k: keyof MapelSummary) => (m[k] as number) + 1
        const updated = { ...m }
        if (old.status === "submitted") updated.submitted = dec("submitted")
        if (old.status === "needs_revision") updated.needs_revision = dec("needs_revision")
        if (old.status === "approved") updated.approved = dec("approved")
        if (newStatus === "submitted") updated.submitted = inc("submitted")
        if (newStatus === "needs_revision") updated.needs_revision = inc("needs_revision")
        if (newStatus === "approved") updated.approved = inc("approved")
        return updated
      }))
      setRevisionNotes(prev => ({ ...prev, [soalId]: "" }))
    }
  }

  const getRevisionNotes = (notes: string | null) => {
    if (!notes) return ""
    if (notes.includes("Approved")) return "Approved"
    const match = notes.match(/^\[([^\]]+)\]\s*(.*)/)
    return match ? match[2] : notes
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--color-muted-foreground)" }}>Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="sticky top-0 z-10 border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-3 px-4 flex items-center gap-4">
          <a href="/dashboard" className="text-sm hover:underline flex items-center gap-1" style={{ color: "var(--color-muted-foreground)" }}>
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </a>
          <h1 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>Validasi Soal</h1>
          {selectedMapel && (
            <>
              <span style={{ color: "var(--color-muted-foreground)" }}>/</span>
              <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{selectedMapel.nama}</span>
            </>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4">

        {/* Mapel grid — selalu tampil */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {mapelSummaries.length === 0 && (
            <div className="col-span-full text-center py-10 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
              Belum ada soal yang disubmit.
            </div>
          )}
          {mapelSummaries.map(m => {
            const isActive = selectedMapel?.id === m.id
            const hasPending = m.submitted + m.needs_revision > 0
            return (
              <button
                key={m.id}
                onClick={() => openMapel(m)}
                className="text-left rounded-xl border p-4 transition-all"
                style={{
                  backgroundColor: isActive ? "var(--color-primary)" : "var(--color-card)",
                  borderColor: isActive ? "var(--color-primary)" : hasPending ? "#f59e0b" : "var(--color-border)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <span className="text-sm font-semibold leading-tight" style={{ color: isActive ? "white" : "var(--color-foreground)" }}>
                    {m.nama}
                  </span>
                  {m.kode && (
                    <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{
                      backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "var(--color-muted)",
                      color: isActive ? "white" : "var(--color-muted-foreground)"
                    }}>
                      {m.kode}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {m.submitted > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: isActive ? "rgba(255,255,255,0.85)" : "#b45309" }}>
                      <Clock className="w-3 h-3" /> {m.submitted}
                    </span>
                  )}
                  {m.needs_revision > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: isActive ? "rgba(255,255,255,0.85)" : "#dc2626" }}>
                      <AlertCircle className="w-3 h-3" /> {m.needs_revision}
                    </span>
                  )}
                  {m.approved > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: isActive ? "rgba(255,255,255,0.85)" : "#15803d" }}>
                      <CheckCircle className="w-3 h-3" /> {m.approved}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Soal list */}
        {selectedMapel && (
          <div className="rounded-xl border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
              <h2 className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>{selectedMapel.nama}</h2>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                <span className="flex items-center gap-1" style={{ color: "#b45309" }}><Clock className="w-3 h-3" />{selectedMapel.submitted}</span>
                <span className="flex items-center gap-1" style={{ color: "#dc2626" }}><AlertCircle className="w-3 h-3" />{selectedMapel.needs_revision}</span>
                <span className="flex items-center gap-1" style={{ color: "#15803d" }}><CheckCircle className="w-3 h-3" />{selectedMapel.approved}</span>
              </div>
            </div>

            {loadingSoal ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>Memuat soal...</div>
            ) : soalList.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>Belum ada soal untuk mata pelajaran ini.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {soalList.map((soal, index) => (
                  <div key={soal.id} className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-7 h-7 shrink-0 border rounded-lg flex items-center justify-center font-bold text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
                          {index + 1}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded font-medium" style={{ backgroundColor: "var(--color-primary)", color: "white" }}>{soal.tipe}</span>
                        <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>{soal.tingkat_kesulitan}</span>
                        <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>{soal.bab_id_text}</span>
                        <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {soal.bobot}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded font-medium shrink-0 ${
                        soal.status === "approved" ? "bg-green-600 text-white" :
                        soal.status === "needs_revision" ? "bg-red-500 text-white" :
                        "bg-yellow-500 text-white"
                      }`}>{soal.status}</span>
                    </div>

                    <div className="text-sm mb-3 ml-9 rich-html" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />

                    {soal.pilihan && soal.pilihan.length > 0 && (
                      <div className="ml-9 mb-3 space-y-1">
                        {soal.pilihan.map((p: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="font-medium shrink-0">{String.fromCharCode(65 + i)}.</span>
                            <span
                              className="rich-html flex-1"
                              dangerouslySetInnerHTML={{ __html: p.teks || "" }}
                            />
                            {p.benar && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0" style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>
                                Benar
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Catatan revisi sebelumnya */}
                    {soal.revision_notes && (
                      <div className={`ml-9 mb-3 p-2 rounded border text-xs ${
                        soal.status === "approved"
                          ? "border-green-200 text-green-700"
                          : "border-red-200 text-red-700"
                        }`}
                        style={{ backgroundColor: soal.status === "approved" ? "#f0fdf4" : "#fff1f2" }}
                      >
                        <strong>{soal.revision_notes.match(/^\[([^\]]+)\]/)?.[1] || "Validator"}:</strong> {getRevisionNotes(soal.revision_notes)}
                      </div>
                    )}

                    {soal.revision_history && soal.revision_history.length > 1 && (
                      <details className="ml-9 mb-3">
                        <summary className="text-xs cursor-pointer" style={{ color: "var(--color-muted-foreground)" }}>
                          Lihat history ({soal.revision_history.length} catatan)
                        </summary>
                        <div className="mt-1 space-y-1">
                          {soal.revision_history.map((h: string, i: number) => (
                            <div key={i} className="text-xs p-1.5 rounded border" style={{ backgroundColor: "var(--color-muted)", borderColor: "var(--color-border)" }}>
                              {h}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Aksi */}
                    <div className="ml-9 flex gap-2 items-start">
                      <textarea
                        value={revisionNotes[soal.id] ?? ""}
                        onChange={e => setRevisionNotes(prev => ({ ...prev, [soal.id]: e.target.value }))}
                        placeholder="Catatan revisi (opsional untuk approve)..."
                        className="flex-1 p-2 rounded border text-sm"
                        style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                        rows={2}
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleStatusChange(soal.id, "needs_revision")}
                          disabled={saving}
                          className="px-3 py-1.5 text-xs rounded font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          Revisi
                        </button>
                        <button
                          onClick={() => handleStatusChange(soal.id, "approved")}
                          disabled={saving}
                          className="px-3 py-1.5 text-xs rounded font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </div>
                    </div>

                    <div className="ml-9 mt-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      {new Date(soal.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
