"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"

interface Bab {
  id: string
  nama_bab: string
  is_submitted: boolean
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "isian_singkat", "essay"]
const TIPE_LABELS: Record<string, string> = {
  pilgan: "Pilgan",
  ceklist: "Ceklist",
  isian_singkat: "Isian Singkat",
  essay: "Essay",
}
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

const INITIAL_DATA: Record<string, number> = {}
TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
  INITIAL_DATA[`${t}_${k}_keluar`] = 0
  INITIAL_DATA[`${t}_${k}_bank`] = 0
}))

export default function MatrixPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [guruMapelId, setGuruMapelId] = useState<string | null>(null)
  const [babs, setBabs] = useState<Bab[]>([])
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, number>>>({})
  const matrixDataRef = useRef<Record<string, Record<string, number>>>({})
  const [patokan, setPatokan] = useState<Record<string, number>>({ ...INITIAL_DATA })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newBabName, setNewBabName] = useState("")
  const [editingBab, setEditingBab] = useState<string | null>(null)
  const [editBabName, setEditBabName] = useState("")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type })
  }

  const loadBabsFromDB = async (userId: string, mapelId: string | null = null) => {
    const { data } = await supabase
      .from("psat_matrix_input")
      .select("bab_id_text, data, is_submitted")
      .eq("profile_id", userId)

    if (data && data.length > 0) {
      const dataMap: Record<string, Record<string, number>> = {}
      data.forEach(b => {
        let parsed = b.data
        if (typeof parsed === "string") { try { parsed = JSON.parse(parsed) } catch { parsed = null } }
        dataMap[b.bab_id_text] = { ...INITIAL_DATA, ...(parsed || {}) }
      })
      matrixDataRef.current = dataMap
      setMatrixData(dataMap)
      setBabs(data.map(b => ({ id: b.bab_id_text, nama_bab: b.bab_id_text, is_submitted: b.is_submitted })))
    } else {
      const defaultName = "Bab 1"
      await supabase.from("psat_matrix_input").insert({
        profile_id: userId, mapel_id: mapelId,
        bab_id_text: defaultName, data: { ...INITIAL_DATA }, is_submitted: false,
      })
      matrixDataRef.current = { [defaultName]: { ...INITIAL_DATA } }
      setMatrixData({ [defaultName]: { ...INITIAL_DATA } })
      setBabs([{ id: defaultName, nama_bab: defaultName, is_submitted: false }])
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const { data: guruData } = await supabase
        .from("psat_guru_data")
        .select("mapel_id")
        .eq("profile_id", u.id)
        .maybeSingle()

      const mapelId = guruData?.mapel_id ?? null
      setGuruMapelId(mapelId)
      await loadBabsFromDB(u.id, mapelId)

      if (mapelId) {
        const { data: patokanRows } = await supabase
          .from("psat_patokan_soal")
          .select("*")
          .eq("mapel_id", mapelId)
          .order("created_at", { ascending: false })
          .limit(1)

        const pd = patokanRows?.[0]
        if (pd) {
          const p: Record<string, number> = {}
          const tipes = (pd.tipe || "").split(",")
          const tingkatans = (pd.tingkat_kesulitan || "").split(",")
          const keluarArr = (pd.keluar || "").split(",")
          const bankArr = (pd.bank || "").split(",")
          let i = 0
          tipes.forEach((t: string) => tingkatans.forEach((k: string) => {
            p[`${t}_${k}_keluar`] = parseInt(keluarArr[i]) || 0
            p[`${t}_${k}_bank`] = parseInt(bankArr[i]) || 0
            i++
          }))
          setPatokan({ ...INITIAL_DATA, ...p })
        }
      }
      setLoading(false)
    }
    load()
  }, [router])

  const setMatrixDataSync = (newData: Record<string, Record<string, number>>) => {
    matrixDataRef.current = newData
    setMatrixData(newData)
  }

  const getTotals = () => {
    const totals: Record<string, number> = {}
    TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
      totals[`${t}_${k}_keluar`] = Object.values(matrixDataRef.current).reduce((s, d) => s + (d?.[`${t}_${k}_keluar`] || 0), 0)
      totals[`${t}_${k}_bank`] = Object.values(matrixDataRef.current).reduce((s, d) => s + (d?.[`${t}_${k}_bank`] || 0), 0)
    }))
    return totals
  }

  const validateAll = (): string[] => {
    const errors: string[] = []
    const totals = getTotals()
    TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
      const tk = `${t}_${k}_keluar`, tb = `${t}_${k}_bank`
      if (patokan[tk] > 0 && totals[tk] !== patokan[tk])
        errors.push(`${TIPE_LABELS[t]} ${k} soal keluar: target ${patokan[tk]}, aktual ${totals[tk]}`)
      if (patokan[tb] > 0 && totals[tb] !== patokan[tb])
        errors.push(`${TIPE_LABELS[t]} ${k} bank: target ${patokan[tb]}, aktual ${totals[tb]}`)
    }))
    return errors
  }

  const handleAddBab = async () => {
    if (!newBabName.trim() || !user) return
    const { error } = await supabase.from("psat_matrix_input").insert({
      profile_id: user.id, mapel_id: guruMapelId,
      bab_id_text: newBabName.trim(), data: { ...INITIAL_DATA }, is_submitted: false,
    })
    if (error) { showToast("Error: " + error.message, "error"); return }
    setBabs(prev => [...prev, { id: newBabName.trim(), nama_bab: newBabName.trim(), is_submitted: false }])
    setMatrixDataSync({ ...matrixDataRef.current, [newBabName.trim()]: { ...INITIAL_DATA } })
    setNewBabName("")
    setIsAdding(false)
  }

  const handleDeleteBab = async (babId: string) => {
    if (babs.find(b => b.id === babId)?.is_submitted) return
    if (!confirm(`Hapus "${babId}"? Data matrix akan hilang.`)) return
    const { error } = await supabase.from("psat_matrix_input").delete()
      .eq("profile_id", user.id).eq("bab_id_text", babId)
    if (error) { showToast("Error: " + error.message, "error"); return }
    setBabs(prev => prev.filter(b => b.id !== babId))
    const newData = { ...matrixDataRef.current }
    delete newData[babId]
    setMatrixDataSync(newData)
  }

  const handleRenameBab = async (oldId: string) => {
    if (!editBabName.trim() || !user || babs.find(b => b.id === oldId)?.is_submitted) {
      setEditingBab(null); return
    }
    await supabase.from("psat_matrix_input")
      .update({ bab_id_text: editBabName.trim(), updated_at: new Date().toISOString() })
      .eq("profile_id", user.id).eq("bab_id_text", oldId)
    const newData = { ...matrixDataRef.current }
    newData[editBabName.trim()] = newData[oldId]
    delete newData[oldId]
    setBabs(prev => prev.map(b => b.id === oldId ? { ...b, id: editBabName.trim(), nama_bab: editBabName.trim() } : b))
    setMatrixDataSync(newData)
    setEditingBab(null)
    setEditBabName("")
  }

  const handleFieldChange = (babId: string, field: string, value: number) => {
    if (field.endsWith("_keluar")) {
      const bankField = field.replace("_keluar", "_bank")
      const currentBank = matrixDataRef.current[babId]?.[bankField] || 0
      if (value > currentBank) { showToast(`Soal keluar (${value}) tidak boleh melebihi bank soal (${currentBank})`, "error"); return }
      if (currentBank > 0 && value === 0) { showToast("Soal keluar minimal 1 jika bank soal > 0", "error"); return }
    }
    setMatrixDataSync({
      ...matrixDataRef.current,
      [babId]: { ...matrixDataRef.current[babId], [field]: value },
    })
  }

  const handleSave = async (babId: string) => {
    if (!user || !matrixDataRef.current[babId]) return
    await supabase.from("psat_matrix_input")
      .update({ data: matrixDataRef.current[babId], updated_at: new Date().toISOString() })
      .eq("profile_id", user.id).eq("bab_id_text", babId)
  }

  const handleSubmitAll = async () => {
    if (!user) return
    const errors = validateAll()
    if (errors.length > 0) { showToast("Belum sesuai patokan: " + errors[0], "error"); return }
    setSaving(true)
    for (const bab of babs.filter(b => !b.is_submitted)) {
      await supabase.from("psat_matrix_input")
        .update({ data: matrixDataRef.current[bab.id], is_submitted: true, updated_at: new Date().toISOString() })
        .eq("profile_id", user.id).eq("bab_id_text", bab.id)
    }
    setSaving(false)
    await loadBabsFromDB(user.id)
    showToast("Semua matrix berhasil disubmit!", "success")
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>

  const totals = getTotals()

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-full mx-auto py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
              ← Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Input Matrix</h1>
          </div>
          {babs.some(b => !b.is_submitted) && (
            <button
              onClick={handleSubmitAll}
              disabled={saving}
              className="py-2 px-5 rounded-md font-medium text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              {saving ? "Menyimpan..." : "Submit Semua"}
            </button>
          )}
        </div>
      </header>

      <main className="px-4 py-6">
        {/* Manajemen Bab */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {babs.map(bab => (
            <div key={bab.id} className="flex items-center gap-1">
              {!bab.is_submitted && editingBab === bab.id ? (
                <input
                  autoFocus type="text" value={editBabName}
                  onChange={e => setEditBabName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRenameBab(bab.id)}
                  onBlur={() => handleRenameBab(bab.id)}
                  className="px-2 py-1 rounded text-sm w-28 border"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                />
              ) : (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: bab.is_submitted ? "#22c55e" : "var(--color-primary)",
                    color: "#fff",
                    cursor: bab.is_submitted ? "default" : "pointer",
                  }}
                  onClick={() => { if (!bab.is_submitted) { setEditingBab(bab.id); setEditBabName(bab.nama_bab) } }}
                >
                  {bab.is_submitted
                    ? <Check className="w-3.5 h-3.5 shrink-0" />
                    : <Pencil className="w-3 h-3 shrink-0 opacity-70" />
                  }
                  {bab.nama_bab}
                </span>
              )}
              {!bab.is_submitted && (
                <button onClick={() => handleDeleteBab(bab.id)} className="text-sm w-4" style={{ color: "var(--color-destructive)" }}>×</button>
              )}
            </div>
          ))}
          {isAdding ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus type="text" value={newBabName}
                onChange={e => setNewBabName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddBab()}
                onBlur={() => { if (!newBabName) setIsAdding(false) }}
                placeholder="Nama bab..."
                className="px-2 py-1 rounded text-sm w-28 border"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              />
              <button onClick={handleAddBab} style={{ color: "var(--color-primary)" }}>✓</button>
              <button onClick={() => { setIsAdding(false); setNewBabName("") }} style={{ color: "var(--color-muted-foreground)" }}>×</button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1 rounded-full text-sm border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
            >
              + Tambah Bab
            </button>
          )}
        </div>

        {/* Progress vs Patokan */}
        <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm" style={{ color: "var(--color-foreground)" }}>Progress vs Patokan</h3>
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
              aktual / target
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TIPE_OPTIONS.map(tipe => (
              <div key={tipe}>
                <div className="text-xs font-semibold mb-2 capitalize" style={{ color: "var(--color-foreground)" }}>{TIPE_LABELS[tipe]}</div>
                {KESULITAN_OPTIONS.map(k => {
                  const ak = totals[`${tipe}_${k}_keluar`] || 0
                  const ab = totals[`${tipe}_${k}_bank`] || 0
                  const tk = patokan[`${tipe}_${k}_keluar`] || 0
                  const tb = patokan[`${tipe}_${k}_bank`] || 0
                  const okK = tk > 0 && ak >= tk
                  const okB = tb > 0 && ab >= tb
                  return (
                    <div key={k} className="flex items-center gap-1 mb-1">
                      <span className="text-xs capitalize w-14" style={{ color: "var(--color-muted-foreground)" }}>{k}</span>
                      <span className="flex-1 px-1 py-0.5 rounded text-xs text-center flex items-center justify-center gap-0.5"
                        style={{ backgroundColor: tk === 0 ? "var(--color-muted)" : okK ? "#f0fdf4" : "#fef2f2", color: tk === 0 ? "var(--color-muted-foreground)" : okK ? "#15803d" : "#dc2626" }}>
                        {tk > 0 && (okK ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />)}
                        {ak}/{tk}
                      </span>
                      <span className="flex-1 px-1 py-0.5 rounded text-xs text-center flex items-center justify-center gap-0.5"
                        style={{ backgroundColor: tb === 0 ? "var(--color-muted)" : okB ? "#f0fdf4" : "#fef2f2", color: tb === 0 ? "var(--color-muted-foreground)" : okB ? "#15803d" : "#dc2626" }}>
                        {tb > 0 && (okB ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />)}
                        {ab}/{tb}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Tabel Matrix */}
        {babs.length === 0 ? (
          <div className="rounded-lg p-8 border text-center" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <p style={{ color: "var(--color-muted-foreground)" }}>Klik "+ Tambah Bab" untuk menambah bab/chapter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse w-full" style={{ minWidth: "700px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--color-muted)" }}>
                  <th className="border px-3 py-2 text-left font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }} rowSpan={2}>Bab</th>
                  <th className="border px-3 py-2 text-left font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }} rowSpan={2}>Tingkat</th>
                  {TIPE_OPTIONS.map(tipe => (
                    <th key={tipe} className="border px-3 py-2 text-center font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }} colSpan={2}>
                      {TIPE_LABELS[tipe]}
                    </th>
                  ))}
                  <th className="border px-3 py-2 text-center font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }} colSpan={2}>Total</th>
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
                {babs.map((bab, bi) => {
                  const p = matrixData[bab.id] || INITIAL_DATA
                  const submitted = bab.is_submitted
                  const rowBg = bi % 2 === 0 ? "var(--color-card)" : "var(--color-muted)"
                  const totalBg = submitted ? "#f0fdf4" : bi % 2 === 0 ? "#f0fdf4" : "#dcfce7"

                  return (
                    <React.Fragment key={bab.id}>
                      {KESULITAN_OPTIONS.map((k, ki) => {
                        const rowSoal = TIPE_OPTIONS.reduce((s, t) => s + (p[`${t}_${k}_keluar`] || 0), 0)
                        const rowBank = TIPE_OPTIONS.reduce((s, t) => s + (p[`${t}_${k}_bank`] || 0), 0)
                        return (
                          <tr key={`${bab.id}-${k}`} style={{ backgroundColor: rowBg }}>
                            {ki === 0 && (
                              <td
                                className="border px-3 py-2 font-medium"
                                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)", verticalAlign: "middle" }}
                                rowSpan={KESULITAN_OPTIONS.length + 1}
                              >
                                <div className="flex items-center gap-1.5">
                                  {submitted && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#22c55e" }} />}
                                  {bab.nama_bab}
                                </div>
                              </td>
                            )}
                            <td className="border px-3 py-1.5 capitalize text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}>
                              {k}
                            </td>
                            {TIPE_OPTIONS.map(tipe => (
                              <React.Fragment key={tipe}>
                                <td className="border px-1 py-1" style={{ borderColor: "var(--color-border)" }}>
                                  <input
                                    type="number" min="0"
                                    value={p[`${tipe}_${k}_keluar`] || 0}
                                    onChange={e => !submitted && handleFieldChange(bab.id, `${tipe}_${k}_keluar`, parseInt(e.target.value) || 0)}
                                    onBlur={() => !submitted && handleSave(bab.id)}
                                    disabled={submitted}
                                    className="w-14 px-1 py-0.5 rounded text-xs text-center border"
                                    style={{ backgroundColor: submitted ? "var(--color-muted)" : "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)", cursor: submitted ? "not-allowed" : "auto" }}
                                  />
                                </td>
                                <td className="border px-1 py-1" style={{ borderColor: "var(--color-border)" }}>
                                  <input
                                    type="number" min="0"
                                    value={p[`${tipe}_${k}_bank`] || 0}
                                    onChange={e => !submitted && handleFieldChange(bab.id, `${tipe}_${k}_bank`, parseInt(e.target.value) || 0)}
                                    onBlur={() => !submitted && handleSave(bab.id)}
                                    disabled={submitted}
                                    className="w-14 px-1 py-0.5 rounded text-xs text-center border"
                                    style={{ backgroundColor: submitted ? "var(--color-muted)" : "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)", cursor: submitted ? "not-allowed" : "auto" }}
                                  />
                                </td>
                              </React.Fragment>
                            ))}
                            <td className="border px-2 py-1 text-center text-xs font-semibold" style={{ borderColor: "var(--color-border)", backgroundColor: totalBg, color: "#15803d" }}>{rowSoal}</td>
                            <td className="border px-2 py-1 text-center text-xs font-semibold" style={{ borderColor: "var(--color-border)", backgroundColor: totalBg, color: "#b45309" }}>{rowBank}</td>
                          </tr>
                        )
                      })}

                      {/* Baris total per bab */}
                      <tr style={{ backgroundColor: totalBg, borderBottom: "2px solid var(--color-border)" }}>
                        <td className="border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}>Total</td>
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
            </table>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
