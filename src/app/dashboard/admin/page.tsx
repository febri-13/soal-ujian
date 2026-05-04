"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface MataPelajaran {
  id: string
  nama: string
  kode: string | null
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "essay"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

const INITIAL_PATOKAN: Record<string, number> = {
  pilgan_mudah_keluar: 0, pilgan_mudah_bank: 0,
  pilgan_sedang_keluar: 0, pilgan_sedang_bank: 0,
  pilgan_sulit_keluar: 0, pilgan_sulit_bank: 0,
  ceklist_mudah_keluar: 0, ceklist_mudah_bank: 0,
  ceklist_sedang_keluar: 0, ceklist_sedang_bank: 0,
  ceklist_sulit_keluar: 0, ceklist_sulit_bank: 0,
  essay_mudah_keluar: 0, essay_mudah_bank: 0,
  essay_sedang_keluar: 0, essay_sedang_bank: 0,
  essay_sulit_keluar: 0, essay_sulit_bank: 0,
}

function parsePatokan(data: any): Record<string, number> {
  const p: Record<string, number> = {}
  const tipes = (data.tipe || "").split(",")
  const tingkatans = (data.tingkat_kesulitan || "").split(",")
  const keluarArr = (data.keluar || "").split(",")
  const bankArr = (data.bank || "").split(",")

  let i = 0
  tipes.forEach((tipe: string) => {
    tingkatans.forEach((kesulitan: string) => {
      p[`${tipe}_${kesulitan}_keluar`] = parseInt(keluarArr[i]) || 0
      p[`${tipe}_${kesulitan}_bank`] = parseInt(bankArr[i]) || 0
      i++
    })
  })
  return p
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mataPelajaran, setMataPelajaran] = useState<MataPelajaran[]>([])
  const [selectedMapelId, setSelectedMapelId] = useState("")
  const [patokan, setPatokan] = useState<Record<string, number>>(INITIAL_PATOKAN)
  const [loading, setLoading] = useState(true)
  const [loadingPatokan, setLoadingPatokan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      // Pastikan admin punya record di profiles (bypass trigger saat insert manual)
      await supabase.from("profiles").upsert({ id: u.id, email: u.email }, { onConflict: "id" })

      const { data } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama")
      if (data) setMataPelajaran(data)
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!selectedMapelId) {
      setPatokan(INITIAL_PATOKAN)
      return
    }
    async function loadPatokan() {
      setLoadingPatokan(true)
      const { data: rows } = await supabase
        .from("psat_patokan_soal")
        .select("*")
        .eq("mapel_id", selectedMapelId)
        .order("created_at", { ascending: false })
        .limit(1)

      const data = rows?.[0] || null
      setPatokan(data ? { ...INITIAL_PATOKAN, ...parsePatokan(data) } : INITIAL_PATOKAN)
      setLoadingPatokan(false)
    }
    loadPatokan()
  }, [selectedMapelId])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleChange = (field: string, value: number) => {
    setPatokan(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user || !selectedMapelId) return
    setSaving(true)

    const tipe = TIPE_OPTIONS.join(",")
    const tingkat_kesulitan = KESULITAN_OPTIONS.join(",")
    const keluar = TIPE_OPTIONS.flatMap(t =>
      KESULITAN_OPTIONS.map(k => patokan[`${t}_${k}_keluar`] || 0)
    ).join(",")
    const bank = TIPE_OPTIONS.flatMap(t =>
      KESULITAN_OPTIONS.map(k => patokan[`${t}_${k}_bank`] || 0)
    ).join(",")

    const { data: rows } = await supabase
      .from("psat_patokan_soal")
      .select("id")
      .eq("mapel_id", selectedMapelId)
      .limit(1)

    const existing = rows?.[0] || null

    if (existing) {
      const { error } = await supabase
        .from("psat_patokan_soal")
        .update({ tipe, tingkat_kesulitan, keluar, bank, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) { showToast("Error: " + error.message, "error"); setSaving(false); return }
    } else {
      const { error } = await supabase
        .from("psat_patokan_soal")
        .insert({ profile_id: user.id, mapel_id: selectedMapelId, tipe, tingkat_kesulitan, keluar, bank })
      if (error) { showToast("Error: " + error.message, "error"); setSaving(false); return }
    }

    setSaving(false)
    showToast("Patokan berhasil disimpan!", "success")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
            ← Kembali
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Admin — Patokan Soal</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-foreground)" }}>Mata Pelajaran</label>
            <select
              value={selectedMapelId}
              onChange={(e) => setSelectedMapelId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              <option value="">Pilih Mata Pelajaran</option>
              {mataPelajaran.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>

          {selectedMapelId && (
            loadingPatokan ? (
              <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>Memuat patokan...</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {TIPE_OPTIONS.map(tipe => (
                    <div key={tipe} className="rounded-lg p-4 border" style={{ borderColor: "var(--color-border)" }}>
                      <h3 className="font-semibold capitalize mb-3" style={{ color: "var(--color-foreground)" }}>{tipe}</h3>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs w-16" />
                        <span className="text-xs w-14 text-center" style={{ color: "var(--color-muted-foreground)" }}>soal</span>
                        <span className="text-xs w-14 text-center" style={{ color: "var(--color-muted-foreground)" }}>bank</span>
                      </div>

                      {KESULITAN_OPTIONS.map(kesulitan => (
                        <div key={kesulitan} className="flex items-center gap-2 mb-2">
                          <span className="text-xs capitalize w-16" style={{ color: "var(--color-muted-foreground)" }}>{kesulitan}</span>
                          <input
                            type="number"
                            min="0"
                            value={patokan[`${tipe}_${kesulitan}_keluar`] || 0}
                            onChange={(e) => handleChange(`${tipe}_${kesulitan}_keluar`, parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-1 rounded text-sm text-center border"
                            style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                          <input
                            type="number"
                            min="0"
                            value={patokan[`${tipe}_${kesulitan}_bank`] || 0}
                            onChange={(e) => handleChange(`${tipe}_${kesulitan}_bank`, parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-1 rounded text-sm text-center border"
                            style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        </div>
                      ))}

                      <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                        <span className="text-xs font-medium w-16" style={{ color: "var(--color-foreground)" }}>Total</span>
                        <span className="w-14 px-2 py-1 rounded text-sm text-center font-medium" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}>
                          {KESULITAN_OPTIONS.reduce((s, k) => s + (patokan[`${tipe}_${k}_keluar`] || 0), 0)}
                        </span>
                        <span className="w-14 px-2 py-1 rounded text-sm text-center font-medium" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}>
                          {KESULITAN_OPTIONS.reduce((s, k) => s + (patokan[`${tipe}_${k}_bank`] || 0), 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="py-2 px-6 rounded-md font-medium disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                  >
                    {saving ? "Menyimpan..." : "Simpan Patokan"}
                  </button>
                </div>
              </>
            )
          )}
        </div>
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
