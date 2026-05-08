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

const TIPE_LABELS: Record<string, string> = {
  pilgan: "Pilgan",
  ceklist: "Ceklist",
  isian_singkat: "Isian Singkat",
  essay: "Essay",
}

const KESULITAN_LABELS: Record<string, string> = {
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
}

// Bobot default sistem (fallback jika mapel belum dikonfigurasi)
const BOBOT_DEFAULT: Record<string, Record<string, number>> = {
  pilgan:        { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
  ceklist:       { mudah: 1.5, sedang: 2.0, sulit: 2.5 },
  isian_singkat: { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
  essay:         { mudah: 2.0, sedang: 3.0, sulit: 4.0 },
}

// --- Patokan helpers ---
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

// --- Bobot helpers ---
// bobotMap[mapelId][`${tipe}_${kesulitan}`] = nilai bobot
type BobotMap = Record<string, Record<string, number>>

function buildEmptyBobot(): Record<string, number> {
  const b: Record<string, number> = {}
  TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
    b[`${t}_${k}`] = BOBOT_DEFAULT[t]?.[k] ?? 1.0
  }))
  return b
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mataPelajaran, setMataPelajaran] = useState<MataPelajaran[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // Tab aktif
  const [activeTab, setActiveTab] = useState<"patokan" | "bobot">("patokan")

  // --- State Patokan ---
  const [patokanMap, setPatokanMap] = useState<PatokanMap>({})
  const [saving, setSaving] = useState(false)

  // --- State Bobot ---
  const [bobotMap, setBobotMap] = useState<BobotMap>({})
  const [customBobotMapels, setCustomBobotMapels] = useState<Set<string>>(new Set())
  const [selectedBobotMapel, setSelectedBobotMapel] = useState("")
  const [savingBobot, setSavingBobot] = useState(false)

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
      if (mapels.length > 0) setSelectedBobotMapel(mapels[0].id)

      // Load patokan
      const { data: patokanRows } = await supabase
        .from("psat_patokan_soal")
        .select("*")

      const pMap: PatokanMap = {}
      mapels.forEach(m => { pMap[m.id] = buildEmpty() })
      if (patokanRows) {
        patokanRows.forEach(row => {
          if (pMap[row.mapel_id]) {
            pMap[row.mapel_id] = { ...pMap[row.mapel_id], ...parsePatokan(row) }
          }
        })
      }
      setPatokanMap(pMap)

      // Load bobot config
      const { data: bobotRows } = await supabase
        .from("bobot_config")
        .select("mapel_id, tipe, kesulitan, bobot")

      const bMap: BobotMap = {}
      const customSet = new Set<string>()
      mapels.forEach(m => { bMap[m.id] = buildEmptyBobot() })
      if (bobotRows) {
        bobotRows.forEach((row: any) => {
          if (bMap[row.mapel_id]) {
            bMap[row.mapel_id][`${row.tipe}_${row.kesulitan}`] = Number(row.bobot)
            customSet.add(row.mapel_id)
          }
        })
      }
      setBobotMap(bMap)
      setCustomBobotMapels(customSet)

      setLoading(false)
    }
    load()
  }, [router])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // --- Patokan handlers ---
  const handlePatokanChange = (mapelId: string, field: string, value: number) => {
    setPatokanMap(prev => ({
      ...prev,
      [mapelId]: { ...prev[mapelId], [field]: value },
    }))
  }

  const handleSavePatokan = async () => {
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

  // --- Bobot handlers ---
  const handleBobotChange = (mapelId: string, tipe: string, kesulitan: string, value: number) => {
    setBobotMap(prev => ({
      ...prev,
      [mapelId]: { ...prev[mapelId], [`${tipe}_${kesulitan}`]: value },
    }))
  }

  const handleSaveBobot = async () => {
    if (!selectedBobotMapel) return
    setSavingBobot(true)

    const rows = TIPE_OPTIONS.flatMap(t =>
      KESULITAN_OPTIONS.map(k => ({
        mapel_id: selectedBobotMapel,
        tipe: t,
        kesulitan: k,
        bobot: bobotMap[selectedBobotMapel]?.[`${t}_${k}`] ?? (BOBOT_DEFAULT[t]?.[k] ?? 1.0),
      }))
    )

    // Hapus dulu lalu insert ulang (upsert via delete+insert)
    const { error: delErr } = await supabase
      .from("bobot_config")
      .delete()
      .eq("mapel_id", selectedBobotMapel)

    if (!delErr) {
      const { error: insErr } = await supabase
        .from("bobot_config")
        .insert(rows)

      if (!insErr) {
        setCustomBobotMapels(prev => new Set([...prev, selectedBobotMapel]))
        showToast("Bobot berhasil disimpan!", "success")
      } else {
        showToast("Gagal menyimpan bobot", "error")
      }
    } else {
      showToast("Gagal menyimpan bobot", "error")
    }

    setSavingBobot(false)
  }

  const handleResetBobot = async () => {
    if (!selectedBobotMapel) return
    setSavingBobot(true)

    const { error } = await supabase
      .from("bobot_config")
      .delete()
      .eq("mapel_id", selectedBobotMapel)

    if (!error) {
      setBobotMap(prev => ({
        ...prev,
        [selectedBobotMapel]: buildEmptyBobot(),
      }))
      setCustomBobotMapels(prev => {
        const next = new Set(prev)
        next.delete(selectedBobotMapel)
        return next
      })
      showToast("Bobot direset ke nilai default", "success")
    } else {
      showToast("Gagal reset bobot", "error")
    }

    setSavingBobot(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  const selectedMapelName = mataPelajaran.find(m => m.id === selectedBobotMapel)?.nama ?? ""
  const isCustom = customBobotMapels.has(selectedBobotMapel)

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-full mx-auto py-4 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
              ← Kembali
            </button>
            {/* Tabs */}
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--color-muted)" }}>
              <button
                onClick={() => setActiveTab("patokan")}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={activeTab === "patokan"
                  ? { backgroundColor: "var(--color-card)", color: "var(--color-foreground)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                  : { color: "var(--color-muted-foreground)" }}
              >
                Patokan Soal
              </button>
              <button
                onClick={() => setActiveTab("bobot")}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={activeTab === "bobot"
                  ? { backgroundColor: "var(--color-card)", color: "var(--color-foreground)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                  : { color: "var(--color-muted-foreground)" }}
              >
                Bobot Soal
              </button>
            </div>
          </div>

          {activeTab === "patokan" && (
            <button
              onClick={handleSavePatokan}
              disabled={saving}
              className="py-2 px-5 rounded-md font-medium text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              {saving ? "Menyimpan..." : "Simpan Semua"}
            </button>
          )}
        </div>
      </header>

      {/* ===== TAB PATOKAN ===== */}
      {activeTab === "patokan" && (
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
                                  onChange={e => handlePatokanChange(mapel.id, `${tipe}_${kesulitan}_keluar`, parseInt(e.target.value) || 0)}
                                  className="w-14 px-1 py-0.5 rounded text-xs text-center border"
                                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                                />
                              </td>
                              <td className="border px-1 py-1" style={{ borderColor: "var(--color-border)" }}>
                                <input
                                  type="number"
                                  min="0"
                                  value={p[`${tipe}_${kesulitan}_bank`] || 0}
                                  onChange={e => handlePatokanChange(mapel.id, `${tipe}_${kesulitan}_bank`, parseInt(e.target.value) || 0)}
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
      )}

      {/* ===== TAB BOBOT ===== */}
      {activeTab === "bobot" && (
        <main className="px-4 py-6 max-w-4xl">
          {/* Info header */}
          <div className="mb-5 p-4 rounded-xl text-sm" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
            Bobot menentukan nilai per soal saat ujian. Setiap mata pelajaran bisa punya bobot berbeda —
            misalnya Matematika bisa punya bobot lebih tinggi. Jika mapel belum dikonfigurasi, nilai default sistem digunakan.
          </div>

          <div className="flex flex-col gap-6">
            {/* Pilih mapel + status */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                Mata Pelajaran:
              </label>
              <select
                value={selectedBobotMapel}
                onChange={e => setSelectedBobotMapel(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {mataPelajaran.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nama}{m.kode ? ` (${m.kode})` : ""}
                    {customBobotMapels.has(m.id) ? " ✦" : ""}
                  </option>
                ))}
              </select>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={isCustom
                  ? { backgroundColor: "#dcfce7", color: "#15803d" }
                  : { backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
              >
                {isCustom ? "Kustom" : "Menggunakan Default"}
              </span>
            </div>

            {/* Grid bobot */}
            {selectedBobotMapel && (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "var(--color-muted)" }}>
                      <th className="border px-4 py-2.5 text-left font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}>
                        Tipe Soal
                      </th>
                      {KESULITAN_OPTIONS.map(k => (
                        <th key={k} className="border px-4 py-2.5 text-center font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}>
                          {KESULITAN_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIPE_OPTIONS.map((tipe, ti) => {
                      const rowBg = ti % 2 === 0 ? "var(--color-card)" : "var(--color-muted)"
                      return (
                        <tr key={tipe} style={{ backgroundColor: rowBg }}>
                          <td className="border px-4 py-2 font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}>
                            {TIPE_LABELS[tipe]}
                          </td>
                          {KESULITAN_OPTIONS.map(k => {
                            const key = `${tipe}_${k}`
                            const val = bobotMap[selectedBobotMapel]?.[key] ?? BOBOT_DEFAULT[tipe]?.[k] ?? 1.0
                            const defVal = BOBOT_DEFAULT[tipe]?.[k] ?? 1.0
                            const isModified = val !== defVal
                            return (
                              <td key={k} className="border px-3 py-1.5 text-center" style={{ borderColor: "var(--color-border)" }}>
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={val}
                                    onChange={e => handleBobotChange(selectedBobotMapel, tipe, k, parseFloat(e.target.value) || 0)}
                                    className="w-20 px-2 py-1 rounded border text-center text-sm"
                                    style={{
                                      backgroundColor: "var(--color-input)",
                                      borderColor: isModified ? "var(--color-primary)" : "var(--color-border)",
                                      color: "var(--color-foreground)",
                                    }}
                                  />
                                  {isModified && (
                                    <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                                      default: {defVal}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Nilai Default Sistem (referensi) */}
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-muted-foreground)" }}>
                Nilai Default Sistem (referensi)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TIPE_OPTIONS.map(tipe => (
                  <div key={tipe}>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--color-foreground)" }}>{TIPE_LABELS[tipe]}</p>
                    {KESULITAN_OPTIONS.map(k => (
                      <p key={k} className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                        {KESULITAN_LABELS[k]}: <strong>{BOBOT_DEFAULT[tipe]?.[k] ?? "-"}</strong>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol aksi */}
            <div className="flex gap-3">
              <button
                onClick={handleSaveBobot}
                disabled={savingBobot || !selectedBobotMapel}
                className="py-2 px-6 rounded-lg font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                {savingBobot ? "Menyimpan..." : `Simpan Bobot — ${selectedMapelName}`}
              </button>
              {isCustom && (
                <button
                  onClick={handleResetBobot}
                  disabled={savingBobot}
                  className="py-2 px-6 rounded-lg font-medium text-sm border disabled:opacity-50"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)", backgroundColor: "var(--color-card)" }}
                >
                  Reset ke Default
                </button>
              )}
            </div>

            {/* Ringkasan semua mapel */}
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
                Ringkasan Konfigurasi ({customBobotMapels.size} dari {mataPelajaran.length} mapel dikustomisasi)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {mataPelajaran.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedBobotMapel(m.id)}
                    className="text-left px-3 py-2 rounded-lg border text-xs transition-colors"
                    style={{
                      borderColor: selectedBobotMapel === m.id ? "var(--color-primary)" : "var(--color-border)",
                      backgroundColor: selectedBobotMapel === m.id ? "var(--color-primary)" : "var(--color-card)",
                      color: selectedBobotMapel === m.id ? "var(--color-primary-foreground)" : "var(--color-foreground)",
                    }}
                  >
                    <span className="font-medium block truncate">{m.nama}</span>
                    <span style={{ color: selectedBobotMapel === m.id ? "rgba(255,255,255,0.7)" : "var(--color-muted-foreground)" }}>
                      {customBobotMapels.has(m.id) ? "Kustom" : "Default"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

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
