"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

interface MatrixRow {
  bab_id: string
  nama_bab: string
  data: any
  is_submitted: boolean
}

const INITIAL_DATA = {
  pilgan_mudah_keluar: 0,
  pilgan_mudah_bank: 0,
  pilgan_sedang_keluar: 0,
  pilgan_sedang_bank: 0,
  pilgan_sulit_keluar: 0,
  pilgan_sulit_bank: 0,
  ceklist_mudah_keluar: 0,
  ceklist_mudah_bank: 0,
  ceklist_sedang_keluar: 0,
  ceklist_sedang_bank: 0,
  ceklist_sulit_keluar: 0,
  ceklist_sulit_bank: 0,
  essay_mudah_keluar: 0,
  essay_mudah_bank: 0,
  essay_sedang_keluar: 0,
  essay_sedang_bank: 0,
  essay_sulit_keluar: 0,
  essay_sulit_bank: 0,
}

export default function MatrixPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [chapters, setChapters] = useState<MatrixRow[]>([])
  const [activeChapter, setActiveChapter] = useState<string | null>(null)
  const [matrixData, setMatrixData] = useState(INITIAL_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data: rows } = await supabase
        .from("psat_matrix_input")
        .select("*")
        .eq("profile_id", u.id)
      
      if (rows && rows.length > 0) {
        setChapters(rows.map(r => ({
          bab_id: r.bab_id,
          nama_bab: r.bab_id || "Chapter",
          data: r.data,
          is_submitted: r.is_submitted,
        })))
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleFieldChange = (field: string, value: number) => {
    setMatrixData({ ...matrixData, [field]: value })
  }

  const getTotal = (prefix: string) => {
    return (matrixData as any)[`${prefix}_keluar`] + (matrixData as any)[`${prefix}_bank`]
  }

  const handleSave = async () => {
    if (!user || !activeChapter) return
    setSaving(true)

    const { data: existing } = await supabase
      .from("psat_matrix_input")
      .select("id")
      .eq("profile_id", user.id)
      .eq("bab_id", activeChapter)
      .single()

    if (existing) {
      await supabase
        .from("psat_matrix_input")
        .update({ data: matrixData, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    } else {
      await supabase
        .from("psat_matrix_input")
        .insert({ profile_id: user.id, bab_id: activeChapter, data: matrixData })
    }

    setSaving(false)
  }

  const handleSubmit = async () => {
    if (!user || !activeChapter) return
    setSaving(true)

    await supabase
      .from("psat_matrix_input")
      .update({ is_submitted: true, updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("bab_id", activeChapter)

    setSaving(false)
    router.push("/dashboard/soal")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  const allSubmitted = chapters.every(c => c.is_submitted)

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Input Matrix</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        {!activeChapter ? (
          <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <p className="mb-4" style={{ color: "var(--color-muted-foreground)" }}>
              Pilih chapter untuk input matrix pemetaan soal:
            </p>
            <div className="space-y-2">
              {["Bab 1", "Bab 2", "Bab 3", "Bab 4", "Bab 5", "Bab 6"].map((bab, i) => {
                const existing = chapters.find(c => c.bab_id === bab)
                return (
                  <button
                    key={bab}
                    onClick={() => setActiveChapter(bab)}
                    className="w-full text-left p-4 rounded-lg border flex justify-between items-center"
                    style={{ 
                      backgroundColor: existing?.is_submitted ? "var(--color-accent)" : "var(--color-card)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-foreground)"
                    }}
                  >
                    <span>{bab}</span>
                    {existing?.is_submitted && <span style={{ color: "var(--color-primary)" }}>✓ Submitted</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setActiveChapter(null)} style={{ color: "var(--color-muted-foreground)" }}>
                ← Kembali
              </button>
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-foreground)" }}>{activeChapter}</h2>
            </div>

            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2" style={{ color: "var(--color-foreground)" }}>Tipe</th>
                  <th className="text-center p-2" style={{ color: "var(--color-foreground)" }}>Mudah</th>
                  <th className="text-center p-2" style={{ color: "var(--color-foreground)" }}>Sedang</th>
                  <th className="text-center p-2" style={{ color: "var(--color-foreground)" }}>Sulit</th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {["pilgan", "ceklist", "essay"].map(tipe => (
                  <tr key={tipe}>
                    <td className="p-2 font-medium" style={{ color: "var(--color-foreground)" }}>{tipe.toUpperCase()}</td>
                    {["mudah", "sedang", "sulit"].map(difficulty => (
                      <td key={difficulty} className="p-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Keluar</label>
                            <input
                              type="number"
                              min="0"
                              value={(matrixData as any)[`${tipe}_${difficulty}_keluar`] || 0}
                              onChange={(e) => handleFieldChange(`${tipe}_${difficulty}_keluar`, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 rounded text-center"
                              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Bank</label>
                            <input
                              type="number"
                              min="0"
                              value={(matrixData as any)[`${tipe}_${difficulty}_bank`] || 0}
                              onChange={(e) => handleFieldChange(`${tipe}_${difficulty}_bank`, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 rounded text-center"
                              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                            />
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="py-2 px-4 rounded-md font-medium"
                style={{ borderColor: "var(--color-border)", border: "1px solid" }}
              >
                {saving ? "Menyimpan..." : "Simpan Draft"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2 px-4 rounded-md font-medium"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                Submit & Lanjut ke Soal
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}