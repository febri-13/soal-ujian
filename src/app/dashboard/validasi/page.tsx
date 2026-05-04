"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"

interface Mapel {
  id: string
  nama: string
}

export default function ValidasiPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mapelList, setMapelList] = useState<Mapel[]>([])
  const [selectedMapel, setSelectedMapel] = useState<string>("")
  const [soalList, setSoalList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})

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

      if (!profile || !["admin", "validator"].includes(profile.role)) {
        setToast({ message: "Akses ditolak", type: "error" })
        setTimeout(() => router.push("/dashboard"), 1500)
        return
      }

      setUser(u)

      const { data: validatorProfile } = await supabase
        .from("profiles")
        .select("nama")
        .eq("id", u.id)
        .single()
      
      if (validatorProfile) {
        setUser({ ...u, nama: validatorProfile.nama })
      }

      const { data: mapel } = await supabase
        .from("mata_pelajaran")
        .select("id, nama")
        .order("nama", { ascending: true })

      if (mapel) {
        setMapelList(mapel)
        
        const savedMapelId = localStorage.getItem("selectedMapelId")
        if (savedMapelId) {
          setSelectedMapel(savedMapelId)
          localStorage.removeItem("selectedMapelId")
        }
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleMapelSelect = (mapelId: string) => {
    setSelectedMapel(mapelId)
  }

  useEffect(() => {
    async function loadSoal() {
      if (!selectedMapel) return
      setSoalList([])

      const { data: soal } = await supabase
        .from("bank_soal")
        .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar,status,revision_notes,revision_history,guru_id")
        .eq("mata_pelajaran_id", selectedMapel)
        .in("status", ["submitted", "needs_revision", "approved"])
        .order("created_at", { ascending: true })

      if (soal) {
        setSoalList(soal)
      }
    }
    loadSoal()
  }, [selectedMapel])

  const handleStatusChange = async (soalId: string, newStatus: string) => {
    setSaving(true)
    
    const notes = revisionNotes[soalId] || ""
    const validatorName = user?.nama || "Validator"
    let fullNotes = ""
    
    if (newStatus === "approved") {
      fullNotes = `[${validatorName}] Approved`
    } else {
      fullNotes = notes ? `[${validatorName}] ${notes}` : `[${validatorName}] Review`
    }
    
    // Get current history
    const currentSoal = soalList.find(s => s.id === soalId)
    const currentHistory = currentSoal?.revision_history || []
    const newHistory = [...currentHistory, fullNotes]
    
    const { error } = await supabase
      .from("bank_soal")
      .update({ 
        status: newStatus, 
        revision_notes: fullNotes,
        revision_history: newHistory,
        updated_at: new Date().toISOString() 
      })
      .eq("id", soalId)

    setSaving(false)

    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Status updated!", type: "success" })
      setSoalList(prev => prev.map(s => 
        s.id === soalId ? { ...s, status: newStatus, revision_notes: fullNotes, revision_history: newHistory } : s
      ))
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
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh)" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm hover:underline" style={{ color: "var(--color-muted-foreground)" }}>← Dashboard</a>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Validasi Soal</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border mb-6" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>Pilih Mata Pelajaran</h2>
          
          <select
            value={selectedMapel}
            onChange={e => setSelectedMapel(e.target.value)}
            className="w-full p-2 rounded border"
            style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <option value="">-- Pilih Mata Pelajaran --</option>
            {mapelList.map(m => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>

          {selectedMapel && (
            <div className="mt-4 flex gap-2">
              <div className="px-2 py-1 text-xs rounded bg-gray-200">
                Total Submitted: {soalList.length}
              </div>
            </div>
          )}
        </div>

        {selectedMapel && (
          <div className="rounded-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            {soalList.length === 0 ? (
              <div className="p-6 text-center" style={{ color: "var(--color-muted-foreground)" }}>
                Belum ada soal submitted untuk mata pelajaran ini.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {soalList.map((soal, index) => (
                  <div key={soal.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2">
                        <span className="w-8 h-8 flex-shrink-0 border rounded-lg flex items-center justify-center font-bold text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
                          {index + 1}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground">{soal.tipe}</span>
                        <span className="px-2 py-1 text-xs rounded" style={{ backgroundColor: "var(--color-accent)" }}>{soal.tingkat_kesulitan}</span>
                        <span className="px-2 py-1 text-xs rounded" style={{ backgroundColor: "var(--color-accent)" }}>{soal.bab_id_text}</span>
                        <span className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {soal.bobot}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        soal.status === "approved" ? "bg-green-600 text-white" :
                        soal.status === "needs_revision" ? "bg-red-500 text-white" :
                        "bg-yellow-500 text-white"
                      }`}>{soal.status}</span>
                    </div>

                    <div 
                      className="text-sm mb-2 ml-10"
                      dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                    />

                    {soal.pilihan && soal.pilihan.length > 0 && (
                      <div className="ml-10 mt-2 space-y-1">
                        {soal.pilihan.map((p: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                            <span>{p.teks === "benar" ? "" : p.teks}</span>
                            {p.benar && <span className="text-green-500 text-xs ml-1">(Benar)</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="ml-10 mt-4 flex gap-2 items-start">
                      <textarea
                        value={revisionNotes[soal.id] || getRevisionNotes(soal.revision_notes)}
                        onChange={e => setRevisionNotes(prev => ({ ...prev, [soal.id]: e.target.value }))}
                        placeholder="Catatan revisi..."
                        className="flex-1 p-2 rounded border text-sm"
                        style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                        rows={2}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatusChange(soal.id, "needs_revision")}
                          disabled={saving}
                          className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                        >
                          Revisi
                        </button>
                        <button
                          onClick={() => handleStatusChange(soal.id, "approved")}
                          disabled={saving}
                          className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                      </div>
                    </div>

                    {soal.revision_notes && soal.status !== "approved" && (
                      <div className="ml-10 mt-2 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                        <strong>{soal.revision_notes.match(/^\[([^\]]+)\]/)?.[1] || "Validator"}:</strong> {getRevisionNotes(soal.revision_notes)}
                      </div>
                    )}
                    {soal.revision_notes && soal.status === "approved" && (
                      <div className="ml-10 mt-2 p-2 rounded bg-green-50 border border-green-200 text-green-700 text-xs">
                        <strong>{soal.revision_notes.match(/^\[([^\]]+)\]/)?.[1] || "Validator"}:</strong> {getRevisionNotes(soal.revision_notes)}
                      </div>
                    )}

                    {soal.revision_history && soal.revision_history.length > 1 && (
                      <details className="ml-10 mt-2">
                        <summary className="text-xs cursor-pointer text-gray-500">Lihat history ({soal.revision_history.length} catatan)</summary>
                        <div className="mt-1 space-y-1">
                          {soal.revision_history.map((h: string, i: number) => (
                            <div key={i} className="text-xs p-1 rounded bg-gray-50 border">
                              {h}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <div className="ml-10 mt-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      {new Date(soal.created_at).toLocaleDateString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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