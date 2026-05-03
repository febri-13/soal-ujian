"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"

const STATUS_OPTIONS = ["draft", "submitted", "needs_revision", "approved"]

export default function ValidasiPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [guruList, setGuruList] = useState<any[]>([])
  const [soalByGuru, setSoalByGuru] = useState<Record<string, any[]>>({})
  const [selectedGuru, setSelectedGuru] = useState<string>("")
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

      const { data: gurus } = await supabase
        .from("profiles")
        .select("id,email,nama,role")
        .eq("role", "guru")
        .order("nama", { ascending: true })

      if (gurus) {
        setGuruList(gurus)
        if (gurus.length > 0) {
          setSelectedGuru(gurus[0].id)
        }
      }

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    async function loadSoal() {
      if (!selectedGuru) return

      const { data: soal } = await supabase
        .from("bank_soal")
        .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar,status,revision_notes,guru_id")
        .eq("guru_id", selectedGuru)
        .order("created_at", { ascending: true })

      if (soal) {
        setSoalByGuru(prev => ({ ...prev, [selectedGuru]: soal }))
      }
    }
    loadSoal()
  }, [selectedGuru])

  const handleStatusChange = async (soalId: string, newStatus: string) => {
    setSaving(true)
    
    const notes = revisionNotes[soalId] || ""
    const { error } = await supabase
      .from("bank_soal")
      .update({ 
        status: newStatus, 
        revision_notes: notes,
        updated_at: new Date().toISOString() 
      })
      .eq("id", soalId)

    setSaving(false)

    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Status updated!", type: "success" })
      setSoalByGuru(prev => ({
        ...prev,
        [selectedGuru]: prev[selectedGuru].map(s => 
          s.id === soalId ? { ...s, status: newStatus, revision_notes: notes } : s
        )
      }))
      setRevisionNotes(prev => ({ ...prev, [soalId]: "" }))
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  const currentSoal = soalByGuru[selectedGuru] || []

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
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>Pilih Guru</h2>
          
          <select
            value={selectedGuru}
            onChange={e => setSelectedGuru(e.target.value)}
            className="w-full p-2 rounded border"
            style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            {guruList.map(g => (
              <option key={g.id} value={g.id}>{g.nama || g.email}</option>
            ))}
          </select>

          <div className="mt-4 flex gap-2">
            <div className="px-2 py-1 text-xs rounded bg-gray-200">
              Total: {currentSoal.length}
            </div>
            <div className="px-2 py-1 text-xs rounded bg-yellow-500 text-white">
              Submitted: {currentSoal.filter(s => s.status === "submitted").length}
            </div>
            <div className="px-2 py-1 text-xs rounded bg-red-500 text-white">
              Revisi: {currentSoal.filter(s => s.status === "needs_revision").length}
            </div>
            <div className="px-2 py-1 text-xs rounded bg-green-600 text-white">
              Approved: {currentSoal.filter(s => s.status === "approved").length}
            </div>
          </div>
        </div>

        <div className="rounded-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          {currentSoal.length === 0 ? (
            <div className="p-6 text-center" style={{ color: "var(--color-muted-foreground)" }}>
              Belum ada soal dari guru ini.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {currentSoal.map((soal, index) => (
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
                    <div className="flex gap-2 items-center">
                      {soal.status === "submitted" && (
                        <span className="px-2 py-1 text-xs rounded bg-yellow-500 text-white">Submitted</span>
                      )}
                      {soal.status === "needs_revision" && (
                        <span className="px-2 py-1 text-xs rounded bg-red-500 text-white">Revisi</span>
                      )}
                      {soal.status === "approved" && (
                        <span className="px-2 py-1 text-xs rounded bg-green-600 text-white">Approved</span>
                      )}
                      {(!soal.status || soal.status === "draft") && (
                        <span className="px-2 py-1 text-xs rounded bg-gray-500 text-white">Draft</span>
                      )}
                    </div>
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
                      value={revisionNotes[soal.id] || soal.revision_notes || ""}
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
                        onClick={() => handleStatusChange(soal.id, "submitted")}
                        disabled={saving}
                        className="px-2 py-1 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600"
                      >
                        Pending
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

                  {soal.revision_notes && (
                    <div className="ml-10 mt-2 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                      Catatan sebelumnya: {soal.revision_notes}
                    </div>
                  )}

                  <div className="ml-10 mt-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {new Date(soal.created_at).toLocaleDateString("id-ID")}
                  </div>
                </div>
              ))}
            </div>
          )}
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