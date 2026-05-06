"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface MataPelajaran {
  id: string
  nama: string
  kode: string | null
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "isian_singkat", "essay"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

type PatokanMap = Record<string, Record<string, number>>

function buildEmpty(): Record<string, number> {
  const p: Record<string, number> = {}
  TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
    p[`${t}_${k}_keluar`] = 0
    p[`${t}_${k}_bank`] = 0
  }))
  return p
}

function parsePatokan(data: any): Record<string, number> {
  const p = buildEmpty()
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
  const [patokanMap, setPatokanMap] = useState<PatokanMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const { data: mapels } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama")

      if (!mapels) { setLoading(false); return }
      setMataPelajaran(mapels)

      const { data: patokanRows } = await supabase
        .from("psat_patokan_soal")
        .select("*")

      const map: PatokanMap = {}
      mapels.forEach(m => { map[m.id] = buildEmpty() })
      if (patokanRows) {
        patokanRows.forEach(row => {
          if (map[row.mapel_id]) {
            map[row.mapel_id] = { ...map[row.mapel_id], ...parsePatokan(row) }
          }
        })
      }
      setPatokanMap(map)
      setLoading(false)
    }
    load()
  }, [router])

  const handleChange = (mapelId: string, field: string, value: number) => {
    setPatokanMap(prev => ({
      ...prev,
      [mapelId]: { ...prev[mapelId], [field]: value },
    }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)

    const tipe = TIPE_OPTIONS.join(",")
    const tingkat_kesulitan = KESULITAN_OPTIONS.join(",")

    const { data: existingRows } = await supabase
      .from("psat_patokan_soal")
      .select("id, mapel_id")

    const existingByMapel: Record<string, string> = {}
    existingRows?.forEach(r => { existingByMapel[r.mapel_id] = r.id })

    let hasError = false
    for (const mapel of mataPelajaran) {
      const p = patokanMap[mapel.id] || buildEmpty()
      const keluar = TIPE_OPTIONS.flatMap(t =>
        KESULITAN_OPTIONS.map(k => p[`${t}_${k}_keluar`] || 0)
      ).join(",")
      const bank = TIPE_OPTIONS.flatMap(t =>
        KESULITAN_OPTIONS.map(k => p[`${t}_${k}_bank`] || 0)
      ).join(",")

      const payload = { tipe, tingkat_kesulitan, keluar, bank, updated_at: new Date().toISOString() }

      if (existingByMapel[mapel.id]) {
        const { error } = await supabase
          .from("psat_patokan_soal")
          .update(payload)
          .eq("id", existingByMapel[mapel.id])
        if (error) { hasError = true }
      } else {
        const { error } = await supabase
          .from("psat_patokan_soal")
          .insert({ profile_id: user.id, mapel_id: mapel.id, ...payload })
        if (error) { hasError = true }
      }
    }

    setSaving(false)
    showToast(hasError ? "Sebagian gagal disimpan" : "Semua patokan berhasil disimpan!", hasError ? "error" : "success")
  }

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  const TIPE_LABELS: Record<string, string> = {
    pilgan: "Pilgan",
    ceklist: "Ceklist",
    isian_singkat: "Isian Singkat",
    essay: "Essay",
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-full mx-auto py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
              ← Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Patokan Soal</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-2 px-5 rounded-md font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {saving ? "Menyimpan..." : "Simpan Semua"}
          </button>
        </div>
      </header>

      <main className="px-4 py-6 overflow-x-auto">
        <table className="text-sm border-collapse w-full" style={{ minWidth: "1000px" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted)" }}>
              <th className="border px-3 py-2 text-left font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }} rowSpan={2}>
                Mata Pelajaran
              </th>
              <th className="border px-3 py-2 text-left font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }} rowSpan={2}>
                Tingkat
              </th>
              {TIPE_OPTIONS.map(tipe => (
                <th key={tipe} className="border px-3 py-2 text-center font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }} colSpan={2}>
                  {TIPE_LABELS[tipe]}
                </th>
              ))}
              <th className="border px-3 py-2 text-center font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }} colSpan={2}>
                Total
              </th>
            </tr>
            <tr style={{ backgroundColor: "var(--color-muted)" }}>
              {TIPE_OPTIONS.map(tipe => (
                <React.Fragment key={tipe}>
                  <th className="border px-2 py-1 text-center text-xs font-medium" style={{ borderColor: "var(--color-border)", color: "#15803d" }}>Soal</th>
                  <th className="border px-2 py-1 text-center text-xs font-medium" style={{ borderColor: "var(--color-border)", color: "#b45309" }}>Bank</th>
                </React.Fragment>
              ))}
              <th className="border px-2 py-1 text-center text-xs font-medium" style={{ borderColor: "var(--color-border)", color: "#15803d" }}>Soal</th>
              <th className="border px-2 py-1 text-center text-xs font-medium" style={{ borderColor: "var(--color-border)", color: "#b45309" }}>Bank</th>
            </tr>
          </thead>
          <tbody>
            {mataPelajaran.map((mapel, mi) => {
              const p = patokanMap[mapel.id] || buildEmpty()
              const rowBg = mi % 2 === 0 ? "var(--color-card)" : "var(--color-muted)"
              const totalBg = mi % 2 === 0 ? "#f0fdf4" : "#dcfce7"

              return (
                <React.Fragment key={mapel.id}>
                  {KESULITAN_OPTIONS.map((kesulitan, ki) => {
                    const rowSoal = TIPE_OPTIONS.reduce((s, t) => s + (p[`${t}_${kesulitan}_keluar`] || 0), 0)
                    const rowBank = TIPE_OPTIONS.reduce((s, t) => s + (p[`${t}_${kesulitan}_bank`] || 0), 0)
                    return (
                      <tr key={`${mapel.id}-${kesulitan}`} style={{ backgroundColor: rowBg }}>
                        {ki === 0 && (
                          <td
                            className="border px-3 py-2 font-medium"
                            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)", verticalAlign: "middle" }}
                            rowSpan={KESULITAN_OPTIONS.length + 1}
                          >
                            {mapel.nama}
                            {mapel.kode && (
                              <span className="ml-1.5 text-xs px-1 py-0.5 rounded" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                                {mapel.kode}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="border px-3 py-1.5 capitalize text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}>
                          {kesulitan}
                        </td>
                        {TIPE_OPTIONS.map(tipe => (
                          <React.Fragment key={tipe}>
                            <td className="border px-1 py-1" style={{ borderColor: "var(--color-border)" }}>
                              <input
                                type="number"
                                min="0"
                                value={p[`${tipe}_${kesulitan}_keluar`] || 0}
                                onChange={e => handleChange(mapel.id, `${tipe}_${kesulitan}_keluar`, parseInt(e.target.value) || 0)}
                                className="w-14 px-1 py-0.5 rounded text-xs text-center border"
                                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                              />
                            </td>
                            <td className="border px-1 py-1" style={{ borderColor: "var(--color-border)" }}>
                              <input
                                type="number"
                                min="0"
                                value={p[`${tipe}_${kesulitan}_bank`] || 0}
                                onChange={e => handleChange(mapel.id, `${tipe}_${kesulitan}_bank`, parseInt(e.target.value) || 0)}
                                className="w-14 px-1 py-0.5 rounded text-xs text-center border"
                                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                              />
                            </td>
                          </React.Fragment>
                        ))}
                        <td className="border px-2 py-1 text-center text-xs font-semibold" style={{ borderColor: "var(--color-border)", backgroundColor: totalBg, color: "#15803d" }}>
                          {rowSoal}
                        </td>
                        <td className="border px-2 py-1 text-center text-xs font-semibold" style={{ borderColor: "var(--color-border)", backgroundColor: totalBg, color: "#b45309" }}>
                          {rowBank}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Baris total per mapel */}
                  <tr style={{ backgroundColor: totalBg, borderBottom: "2px solid var(--color-border)" }}>
                    <td className="border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}>
                      Total
                    </td>
                    {TIPE_OPTIONS.map(tipe => {
                      const colSoal = KESULITAN_OPTIONS.reduce((s, k) => s + (p[`${tipe}_${k}_keluar`] || 0), 0)
                      const colBank = KESULITAN_OPTIONS.reduce((s, k) => s + (p[`${tipe}_${k}_bank`] || 0), 0)
                      return (
                        <React.Fragment key={tipe}>
                          <td className="border px-2 py-1 text-center text-xs font-bold" style={{ borderColor: "var(--color-border)", color: "#15803d" }}>{colSoal}</td>
                          <td className="border px-2 py-1 text-center text-xs font-bold" style={{ borderColor: "var(--color-border)", color: "#b45309" }}>{colBank}</td>
                        </React.Fragment>
                      )
                    })}
                    <td className="border px-2 py-1 text-center text-xs font-bold" style={{ borderColor: "var(--color-border)", color: "#15803d" }}>
                      {TIPE_OPTIONS.reduce((s, t) => s + KESULITAN_OPTIONS.reduce((ss, k) => ss + (p[`${t}_${k}_keluar`] || 0), 0), 0)}
                    </td>
                    <td className="border px-2 py-1 text-center text-xs font-bold" style={{ borderColor: "var(--color-border)", color: "#b45309" }}>
                      {TIPE_OPTIONS.reduce((s, t) => s + KESULITAN_OPTIONS.reduce((ss, k) => ss + (p[`${t}_${k}_bank`] || 0), 0), 0)}
                    </td>
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot>
            {(() => {
              const grand: Record<string, number> = {}
              Object.values(patokanMap).forEach(p => {
                TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
                  grand[`${t}_${k}_keluar`] = (grand[`${t}_${k}_keluar`] || 0) + (p[`${t}_${k}_keluar`] || 0)
                  grand[`${t}_${k}_bank`]   = (grand[`${t}_${k}_bank`]   || 0) + (p[`${t}_${k}_bank`]   || 0)
                }))
              })
              const grandTotalSoal = TIPE_OPTIONS.reduce((s, t) => s + KESULITAN_OPTIONS.reduce((ss, k) => ss + (grand[`${t}_${k}_keluar`] || 0), 0), 0)
              const grandTotalBank = TIPE_OPTIONS.reduce((s, t) => s + KESULITAN_OPTIONS.reduce((ss, k) => ss + (grand[`${t}_${k}_bank`]   || 0), 0), 0)
              return (
                <tr style={{ backgroundColor: "#dbeafe", borderTop: "3px solid var(--color-border)" }}>
                  <td colSpan={2} className="border px-3 py-2 text-sm font-bold" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}>
                    Grand Total
                  </td>
                  {TIPE_OPTIONS.map(tipe => {
                    const colSoal = KESULITAN_OPTIONS.reduce((s, k) => s + (grand[`${tipe}_${k}_keluar`] || 0), 0)
                    const colBank = KESULITAN_OPTIONS.reduce((s, k) => s + (grand[`${tipe}_${k}_bank`]   || 0), 0)
                    return (
                      <React.Fragment key={tipe}>
                        <td className="border px-2 py-2 text-center text-sm font-bold" style={{ borderColor: "var(--color-border)", color: "#15803d" }}>{colSoal}</td>
                        <td className="border px-2 py-2 text-center text-sm font-bold" style={{ borderColor: "var(--color-border)", color: "#b45309" }}>{colBank}</td>
                      </React.Fragment>
                    )
                  })}
                  <td className="border px-2 py-2 text-center text-sm font-bold" style={{ borderColor: "var(--color-border)", color: "#15803d" }}>{grandTotalSoal}</td>
                  <td className="border px-2 py-2 text-center text-sm font-bold" style={{ borderColor: "var(--color-border)", color: "#b45309" }}>{grandTotalBank}</td>
                </tr>
              )
            })()}
          </tfoot>
        </table>
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
