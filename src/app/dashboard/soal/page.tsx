"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import RichTextEditor from "@/components/RichTextEditor"
import ImageUpload from "@/components/ImageUpload"

interface BabMatrix {
  bab_id_text: string
  data: Record<string, number>
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "essay", "isian_singkat"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

const BOBOT_DEFAULT: Record<string, Record<string, number>> = {
  pilgan:        { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
  ceklist:       { mudah: 1.5, sedang: 2.0, sulit: 2.5 },
  essay:         { mudah: 2.0, sedang: 3.0, sulit: 4.0 },
  isian_singkat: { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
}

// bobotConfig[`${tipe}_${kesulitan}`] = nilai bobot untuk mapel guru ini
type BobotConfig = Record<string, number>

export default function SoalPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrixData, setMatrixData] = useState<BabMatrix[]>([])
  const [soalStats, setSoalStats] = useState<Record<string, number>>({})
  const [soalList, setSoalList] = useState<any[]>([])
  const [selectedBab, setSelectedBab] = useState("")
  const [activeBab, setActiveBab] = useState<string | null>(null)
  const [selectedMapelId, setSelectedMapelId] = useState("")
  const [selectedTipe, setSelectedTipe] = useState("pilgan")
  const [selectedKesulitan, setSelectedKesulitan] = useState("mudah")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)
  const [expandedBabs, setExpandedBabs] = useState<Set<string>>(new Set())

  const [pertanyaan, setPertanyaan] = useState("")
  const [gambarUrl, setGambarUrl] = useState("")
  const [pilihan, setPilihan] = useState<string[]>(["", "", "", ""])
  const [pilihanGambar, setPilihanGambar] = useState<string[]>(["", "", "", ""])
  const [jawabanBenar, setJawabanBenar] = useState<number>(0)
  const [jawabanBenarCeklist, setJawabanBenarCeklist] = useState<number[]>([])
  const [bobot, setBobot] = useState<number>(1.0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bobotConfig, setBobotConfig] = useState<BobotConfig>({})

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const { data: matrixRows } = await supabase
        .from("psat_matrix_input")
        .select("bab_id_text,data")
        .eq("profile_id", u.id)
        .eq("is_submitted", true)

      if (!matrixRows || matrixRows.length === 0) {
        setToast({ message: "Silakan submit matrix terlebih dahulu", type: "error" })
        setTimeout(() => router.push("/dashboard/matrix"), 1500)
        return
      }

      setMatrixData(matrixRows as BabMatrix[])
      setExpandedBabs(new Set(matrixRows.map((r: any) => r.bab_id_text)))

      const firstBab = matrixRows[0].bab_id_text
      setActiveBab(firstBab)
      setSelectedBab(firstBab)

      const { data: guruData } = await supabase
        .from("psat_guru_data")
        .select("mapel_id")
        .eq("profile_id", u.id)
        .maybeSingle()
      if (guruData?.mapel_id) {
        setSelectedMapelId(guruData.mapel_id)

        // Load bobot kustom untuk mapel ini (jika admin sudah set)
        const { data: bobotRows } = await supabase
          .from("bobot_config")
          .select("tipe, kesulitan, bobot")
          .eq("mapel_id", guruData.mapel_id)

        if (bobotRows && bobotRows.length > 0) {
          const cfg: BobotConfig = {}
          bobotRows.forEach((r: any) => { cfg[`${r.tipe}_${r.kesulitan}`] = Number(r.bobot) })
          setBobotConfig(cfg)
          // Update bobot awal sesuai config yang baru dimuat
          setBobot(cfg[`pilgan_mudah`] ?? BOBOT_DEFAULT["pilgan"]?.["mudah"] ?? 1.0)
        }
      }

      await reloadSoal(u.id)
      setLoading(false)
    }
    load()
  }, [router])

  const reloadSoal = async (uid: string) => {
    const { data } = await supabase
      .from("bank_soal")
      .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar,status,revision_notes")
      .eq("guru_id", uid)
      .order("created_at", { ascending: true })

    if (data) {
      setSoalList(data)
      const stats: Record<string, number> = {}
      data.forEach((s: any) => {
        const k = `${s.bab_id_text}_${s.tipe}_${s.tingkat_kesulitan}`
        stats[k] = (stats[k] || 0) + 1
      })
      setSoalStats(stats)
    }
  }

  const getDefaultBobot = (tipe: string, kesulitan: string) =>
    bobotConfig[`${tipe}_${kesulitan}`] ?? BOBOT_DEFAULT[tipe]?.[kesulitan] ?? 1.0

  const getSoalCount = (babId: string, tipe: string, kesulitan: string) =>
    soalStats[`${babId}_${tipe}_${kesulitan}`] || 0

  const getTargetBank = (babId: string, tipe: string, kesulitan: string) => {
    const bab = matrixData.find(b => b.bab_id_text === babId)
    return bab?.data[`${tipe}_${kesulitan}_bank`] || 0
  }

  const getBabProgress = (babId: string) => {
    let done = 0, total = 0
    TIPE_OPTIONS.forEach(t => KESULITAN_OPTIONS.forEach(k => {
      const target = getTargetBank(babId, t, k)
      if (target > 0) {
        total += target
        done += Math.min(getSoalCount(babId, t, k), target)
      }
    }))
    return { done, total }
  }

  const isAllTargetMet = () => {
    if (matrixData.length === 0) return false
    for (const bab of matrixData) {
      for (const tipe of TIPE_OPTIONS) {
        for (const kesulitan of KESULITAN_OPTIONS) {
          if (getSoalCount(bab.bab_id_text, tipe, kesulitan) < getTargetBank(bab.bab_id_text, tipe, kesulitan)) return false
        }
      }
    }
    return true
  }

  const totalTarget = matrixData.reduce((sum, bab) =>
    sum + TIPE_OPTIONS.reduce((s2, t) =>
      s2 + KESULITAN_OPTIONS.reduce((s3, k) =>
        s3 + (bab.data[`${t}_${k}_bank`] || 0), 0), 0), 0)

  const totalDibuat = soalList.length

  const resetForm = () => {
    setPertanyaan("")
    setGambarUrl("")
    setPilihan(["", "", "", ""])
    setPilihanGambar(["", "", "", ""])
    setJawabanBenar(0)
    setJawabanBenarCeklist([])
    setSelectedTipe("pilgan")
    setSelectedKesulitan("mudah")
    setBobot(getDefaultBobot("pilgan", "mudah"))
    setEditingId(null)
  }

  const toggleBab = (babId: string) => {
    setExpandedBabs(prev => {
      const next = new Set(prev)
      if (next.has(babId)) next.delete(babId)
      else next.add(babId)
      return next
    })
  }

  const selectBab = (babId: string) => {
    setActiveBab(babId)
    setSelectedBab(babId)
    resetForm()
  }

  const openSlot = (babId: string, tipe: string, kesulitan: string) => {
    setActiveBab(babId)
    setSelectedBab(babId)
    setEditingId(null)
    setPertanyaan("")
    setGambarUrl("")
    setPilihan(["", "", "", ""])
    setPilihanGambar(["", "", "", ""])
    setJawabanBenar(0)
    setJawabanBenarCeklist([])
    setSelectedTipe(tipe)
    setSelectedKesulitan(kesulitan)
    setBobot(getDefaultBobot(tipe, kesulitan))
  }

  const handleSaveSoal = async () => {
    if (!user || !selectedBab || !pertanyaan.trim()) {
      setToast({ message: "Pertanyaan wajib diisi", type: "error" })
      return
    }

    const currentCount = getSoalCount(selectedBab, selectedTipe, selectedKesulitan)
    const targetBank = getTargetBank(selectedBab, selectedTipe, selectedKesulitan)

    if (!editingId && currentCount >= targetBank) {
      setToast({ message: `Bank soal ${selectedBab} — ${selectedTipe} ${selectedKesulitan} sudah penuh (${currentCount}/${targetBank})`, type: "error" })
      return
    }

    setSaving(true)

    const pilihanObj = (selectedTipe === "pilgan" || selectedTipe === "ceklist")
      ? pilihan.map((p, i) => ({
          id: i,
          teks: p,
          benar: selectedTipe === "ceklist" ? jawabanBenarCeklist.includes(i) : i === jawabanBenar,
        }))
      : null

    let err: any = null

    if (editingId) {
      const { error } = await supabase.from("bank_soal").update({
        pertanyaan,
        tipe: selectedTipe,
        bab_id_text: selectedBab,
        mata_pelajaran_id: selectedMapelId,
        level: selectedKesulitan,
        bobot,
        tingkat_kesulitan: selectedKesulitan,
        pilihan: pilihanObj,
        pilihan_gambar: pilihanGambar.filter(Boolean),
        jawaban_benar: selectedTipe === "pilgan" ? jawabanBenar : null,
        updated_at: new Date().toISOString(),
      }).eq("id", editingId)
      err = error
    } else {
      const { error } = await supabase.from("bank_soal").insert({
        pertanyaan,
        tipe: selectedTipe,
        guru_id: user.id,
        bab_id_text: selectedBab,
        mata_pelajaran_id: selectedMapelId,
        level: selectedKesulitan,
        bobot,
        tingkat_kesulitan: selectedKesulitan,
        pilihan: pilihanObj,
        pilihan_gambar: pilihanGambar.filter(Boolean),
        jawaban_benar: selectedTipe === "pilgan" ? jawabanBenar : null,
        gambar_url: gambarUrl || null,
      })
      err = error
    }

    setSaving(false)

    if (err) {
      setToast({ message: "Error: " + err.message, type: "error" })
      return
    }

    setToast({ message: editingId ? "Soal diupdate!" : "Soal disimpan!", type: "success" })
    resetForm()
    await reloadSoal(user.id)
  }

  const handleEditSoal = async (soal: any) => {
    const { data: soalData } = await supabase
      .from("bank_soal")
      .select("*")
      .eq("id", soal.id)
      .single()
    if (!soalData) return

    setSelectedBab(soalData.bab_id_text || "")
    setActiveBab(soalData.bab_id_text || null)
    setSelectedTipe(soalData.tipe)
    setSelectedKesulitan(soalData.tingkat_kesulitan)
    setPertanyaan(soalData.pertanyaan)
    setBobot(soalData.bobot)
    setEditingId(soalData.id)
    setGambarUrl(soalData.gambar_url || "")

    if (soalData.pilihan) {
      setPilihan(soalData.pilihan.map((p: any) => p.teks || ""))
      if (soalData.tipe === "pilgan") {
        const idx = soalData.pilihan.findIndex((p: any) => p.benar)
        if (idx >= 0) setJawabanBenar(idx)
      } else if (soalData.tipe === "ceklist") {
        setJawabanBenarCeklist(soalData.pilihan.filter((p: any) => p.benar).map((p: any) => p.id))
      }
    }
    if (soalData.pilihan_gambar) setPilihanGambar(soalData.pilihan_gambar)
  }

  const handleDeleteSoal = async (soalId: string) => {
    if (!confirm("Yakin hapus soal ini?")) return
    await supabase.from("bank_soal").delete().eq("id", soalId)
    const updated = soalList.filter(s => s.id !== soalId)
    setSoalList(updated)
    const stats: Record<string, number> = {}
    updated.forEach((s: any) => {
      const k = `${s.bab_id_text}_${s.tipe}_${s.tingkat_kesulitan}`
      stats[k] = (stats[k] || 0) + 1
    })
    setSoalStats(stats)
  }

  const handleKirimValidator = async () => {
    if (!user) return
    if (!confirm("Kirim semua soal ke validator? Setelah dikirim, soal tidak bisa diedit.")) return
    setSaving(true)
    const { error } = await supabase
      .from("bank_soal")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("guru_id", user.id)
      .in("status", ["draft", "needs_revision"])
    setSaving(false)
    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Soal berhasil dikirim ke validator!", type: "success" })
      setSoalList(soalList.map(s => ({ ...s, status: "submitted" })))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        Memuat...
      </div>
    )
  }

  const allMet = isAllTargetMet()
  const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalDibuat / totalTarget) * 100)) : 0
  const activeBabSoal = activeBab ? soalList.filter(s => s.bab_id_text === activeBab) : []

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      {/* Header */}
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1 text-sm"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Input Soal</h1>
          </div>
          <button
            onClick={handleKirimValidator}
            disabled={saving || !allMet}
            className="py-2 px-4 rounded-md font-medium text-sm"
            style={{
              backgroundColor: allMet ? "#16a34a" : "var(--color-muted)",
              color: allMet ? "#fff" : "var(--color-muted-foreground)",
              cursor: allMet ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Mengirim..." : "Kirim ke Validator"}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 px-4 flex gap-6 items-start">
        {/* ── Left Sidebar ── */}
        <div className="w-72 flex-shrink-0 sticky top-6 space-y-3">
          {/* Overall progress */}
          <div className="rounded-lg p-4 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium" style={{ color: "var(--color-foreground)" }}>Progress</span>
              <span style={{ color: "var(--color-muted-foreground)" }}>{totalDibuat}/{totalTarget} ({progressPct}%)</span>
            </div>
            <div className="w-full rounded-full h-2.5" style={{ backgroundColor: "var(--color-muted)" }}>
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: allMet ? "#16a34a" : "#3b82f6" }}
              />
            </div>
            {allMet && (
              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#16a34a" }}>
                <Check className="w-3 h-3" />
                Semua target terpenuhi
              </p>
            )}
          </div>

          {/* Bab navigation tree */}
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            {matrixData.map((bab, babIdx) => {
              const { done: babDone, total: babTotal } = getBabProgress(bab.bab_id_text)
              const isExpanded = expandedBabs.has(bab.bab_id_text)
              const isActive = activeBab === bab.bab_id_text
              const babAllMet = babTotal > 0 && babDone >= babTotal

              return (
                <div key={bab.bab_id_text} className={babIdx > 0 ? "border-t" : ""} style={{ borderColor: "var(--color-border)" }}>
                  {/* Bab header */}
                  <button
                    className="w-full px-3 py-2.5 flex items-center justify-between text-left"
                    style={{
                      backgroundColor: isActive ? "var(--color-primary)" : "var(--color-card)",
                    }}
                    onClick={() => {
                      selectBab(bab.bab_id_text)
                      if (!expandedBabs.has(bab.bab_id_text)) toggleBab(bab.bab_id_text)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: isActive ? "var(--color-primary-foreground)" : "var(--color-foreground)" }}
                      >
                        {bab.bab_id_text}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: isActive ? "var(--color-primary-foreground)" : babAllMet ? "#16a34a" : "var(--color-muted-foreground)", opacity: isActive ? 0.85 : 1 }}
                      >
                        {babDone}/{babTotal} soal
                      </p>
                    </div>
                    <button
                      className="p-0.5 ml-1 flex-shrink-0"
                      style={{ color: isActive ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)", opacity: isActive ? 0.85 : 1 }}
                      onClick={e => { e.stopPropagation(); toggleBab(bab.bab_id_text) }}
                    >
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </button>

                  {/* Slot list */}
                  {isExpanded && (
                    <div className="px-3 pb-2 pt-1 space-y-1" style={{ backgroundColor: "var(--color-background)" }}>
                      {TIPE_OPTIONS.flatMap(tipe =>
                        KESULITAN_OPTIONS.map(kesulitan => {
                          const count = getSoalCount(bab.bab_id_text, tipe, kesulitan)
                          const target = getTargetBank(bab.bab_id_text, tipe, kesulitan)
                          if (target === 0) return null
                          const ok = count >= target
                          const isSelected =
                            isActive && selectedTipe === tipe && selectedKesulitan === kesulitan
                          return (
                            <div
                              key={`${tipe}_${kesulitan}`}
                              className="flex items-center justify-between text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: isSelected
                                  ? "var(--color-primary)"
                                  : ok ? "#f0fdf4" : "#fef2f2",
                                outline: isSelected ? "2px solid var(--color-primary)" : undefined,
                              }}
                              onClick={() => openSlot(bab.bab_id_text, tipe, kesulitan)}
                            >
                              <span
                                className="capitalize"
                                style={{ color: isSelected ? "var(--color-primary-foreground)" : ok ? "#15803d" : "#dc2626" }}
                              >
                                {tipe} · {kesulitan}
                              </span>
                              <span
                                className="flex items-center gap-0.5 font-medium"
                                style={{ color: isSelected ? "var(--color-primary-foreground)" : ok ? "#15803d" : "#dc2626" }}
                              >
                                {ok ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                {count}/{target}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right Content ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Form */}
          <div className="rounded-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                {editingId ? "Edit Soal" : "Tambah Soal"}
                {activeBab && <span style={{ color: "var(--color-muted-foreground)", fontWeight: 400 }}> — {activeBab}</span>}
              </h2>
            </div>

            {!activeBab ? (
              <div className="p-8 text-center" style={{ color: "var(--color-muted-foreground)" }}>
                Pilih bab dari navigasi kiri untuk mulai menambah soal
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Tipe + Kesulitan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--color-muted-foreground)" }}>Tipe</label>
                    <select
                      value={selectedTipe}
                      onChange={e => { setSelectedTipe(e.target.value); setBobot(getDefaultBobot(e.target.value, selectedKesulitan)) }}
                      className="w-full p-2 rounded border text-sm"
                      style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                    >
                      {TIPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--color-muted-foreground)" }}>Tingkat Kesulitan</label>
                    <select
                      value={selectedKesulitan}
                      onChange={e => { setSelectedKesulitan(e.target.value); setBobot(getDefaultBobot(selectedTipe, e.target.value)) }}
                      className="w-full p-2 rounded border text-sm"
                      style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                    >
                      {KESULITAN_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                {/* Pertanyaan */}
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--color-muted-foreground)" }}>Pertanyaan *</label>
                  <RichTextEditor
                    content={pertanyaan}
                    onChange={setPertanyaan}
                    placeholder="Masukkan pertanyaan..."
                  />
                </div>

                {/* Pilihan jawaban */}
                {(selectedTipe === "pilgan" || selectedTipe === "ceklist") && (
                  <div>
                    <label className="block text-xs mb-2" style={{ color: "var(--color-muted-foreground)" }}>Pilihan Jawaban</label>
                    {pilihan.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 mb-3">
                        <div className="mt-2">
                          {selectedTipe === "pilgan" ? (
                            <input
                              type="radio"
                              name="jawabanBenar"
                              checked={jawabanBenar === i}
                              onChange={() => setJawabanBenar(i)}
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={jawabanBenarCeklist.includes(i)}
                              onChange={e => setJawabanBenarCeklist(
                                e.target.checked
                                  ? [...jawabanBenarCeklist, i]
                                  : jawabanBenarCeklist.filter(x => x !== i)
                              )}
                            />
                          )}
                        </div>
                        <span className="mt-2.5 w-5 text-sm font-medium flex-shrink-0" style={{ color: "var(--color-muted-foreground)" }}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <RichTextEditor
                            mini
                            content={p}
                            onChange={html => { const n = [...pilihan]; n[i] = html; setPilihan(n) }}
                            placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                          />
                        </div>
                        <div className="mt-1.5">
                          <ImageUpload
                            value={pilihanGambar[i]}
                            onChange={url => { const n = [...pilihanGambar]; n[i] = url; setPilihanGambar(n) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {bobot}</p>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSoal}
                    disabled={saving}
                    className="py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                  >
                    {saving ? "Menyimpan..." : editingId ? "Update" : "Simpan"}
                  </button>
                  {editingId && (
                    <button
                      onClick={resetForm}
                      className="py-2 px-4 rounded-md text-sm"
                      style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Soal list for active bab */}
          {activeBab && (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                  Daftar Soal — {activeBab}
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-muted-foreground)" }}>
                    ({activeBabSoal.length} soal)
                  </span>
                </h2>
              </div>

              {activeBabSoal.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                  Belum ada soal untuk bab ini
                </div>
              ) : (
                <div>
                  {activeBabSoal.map((soal, idx) => (
                    <div
                      key={soal.id}
                      className="px-4 py-3 flex items-start gap-3 border-b last:border-b-0"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>
                            {soal.tipe}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                            {soal.tingkat_kesulitan}
                          </span>
                          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {soal.bobot}</span>
                          {soal.status === "submitted" && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500 text-white">Submitted</span>}
                          {soal.status === "approved" && <span className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-white">Approved</span>}
                          {soal.status === "needs_revision" && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white">Revisi</span>}
                        </div>
                        <div
                          className="text-sm rich-html"
                          style={{ color: "var(--color-foreground)" }}
                          dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                        />
                        {soal.pilihan && soal.pilihan.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {soal.pilihan.map((p: { id: number; teks: string; benar: boolean }) => (
                              <div
                                key={p.id}
                                className="flex items-start gap-1.5 text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: p.benar ? "#f0fdf4" : "var(--color-muted)",
                                  border: p.benar ? "1px solid #bbf7d0" : "1px solid transparent",
                                }}
                              >
                                <span className="font-semibold flex-shrink-0 mt-0.5" style={{ color: p.benar ? "#15803d" : "var(--color-muted-foreground)" }}>
                                  {String.fromCharCode(65 + p.id)}.
                                </span>
                                <div
                                  className="flex-1 min-w-0 rich-html"
                                  style={{ color: p.benar ? "#15803d" : "var(--color-foreground)" }}
                                  dangerouslySetInnerHTML={{ __html: p.teks }}
                                />
                                {p.benar && (
                                  <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#15803d" }} />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {soal.revision_notes && (
                          <div className="mt-1.5 text-xs p-2 rounded" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                            Catatan revisi: {soal.revision_notes}
                          </div>
                        )}
                      </div>
                      {(soal.status === "draft" || soal.status === "needs_revision" || !soal.status) && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEditSoal(soal)}
                            className="p-1.5 rounded hover:opacity-80"
                            style={{ color: "#3b82f6" }}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSoal(soal.id)}
                            className="p-1.5 rounded hover:opacity-80"
                            style={{ color: "#dc2626" }}
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
