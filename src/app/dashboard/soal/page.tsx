"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Check, CircleHelp } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import RichTextEditor from "@/components/RichTextEditor"
import ImageUpload from "@/components/ImageUpload"
import DownloadDropdown from "@/components/DownloadDropdown"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"

interface BabMatrix {
  bab_id_text: string
  data: Record<string, number>
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "essay", "isian_singkat"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

const TIPE_LABELS: Record<string, string> = {
  pilgan: "Pilgan",
  ceklist: "Ceklist",
  essay: "Essay",
  isian_singkat: "Isian Singkat",
}

const TIPE_COLORS: Record<string, { bg: string; accent: string }> = {
  pilgan:        { bg: "#ECE4FF", accent: "#6d28d9" },
  ceklist:       { bg: "#DAF5E7", accent: "#15803d" },
  essay:         { bg: "#FFE3D0", accent: "#c2410c" },
  isian_singkat: { bg: "#FFF5C6", accent: "#92400e" },
}

const KESULITAN_COLORS: Record<string, { bg: string; text: string }> = {
  mudah:  { bg: "#d1fae5", text: "#065f46" },
  sedang: { bg: "#fef9c3", text: "#854d0e" },
  sulit:  { bg: "#fee2e2", text: "#991b1b" },
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft:          { bg: "var(--pp-bg)",   text: "var(--pp-muted)", label: "Draft" },
  submitted:      { bg: "var(--pp-lemon)", text: "var(--pp-ink)",   label: "Dikirim" },
  approved:       { bg: "var(--pp-mint)",  text: "var(--pp-ink)",   label: "Approved" },
  needs_revision: { bg: "var(--pp-pink)",  text: "var(--pp-ink)",   label: "Revisi" },
}

const BOBOT_DEFAULT: Record<string, Record<string, number>> = {
  pilgan:        { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
  ceklist:       { mudah: 1.5, sedang: 2.0, sulit: 2.5 },
  essay:         { mudah: 2.0, sedang: 3.0, sulit: 4.0 },
  isian_singkat: { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
}

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
  const [mapelNama, setMapelNama] = useState("")
  const [selectedTipe, setSelectedTipe] = useState("pilgan")
  const [selectedKesulitan, setSelectedKesulitan] = useState("mudah")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savePressed, setSavePressed] = useState(false)
  const [kirimPressed, setKirimPressed] = useState(false)
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

        const { data: mp } = await supabase
          .from("mata_pelajaran")
          .select("nama")
          .eq("id", guruData.mapel_id)
          .single()
        if (mp) setMapelNama(mp.nama)

        const { data: bobotRows } = await supabase
          .from("bobot_config")
          .select("tipe, kesulitan, bobot")
          .eq("mapel_id", guruData.mapel_id)

        if (bobotRows && bobotRows.length > 0) {
          const cfg: BobotConfig = {}
          bobotRows.forEach((r: any) => { cfg[`${r.tipe}_${r.kesulitan}`] = Number(r.bobot) })
          setBobotConfig(cfg)
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

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session || !selectedMapelId) return
        fetch("/api/notifications/whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ type: "guru_submit", mapelId: selectedMapelId, guruId: user.id }),
        }).catch(() => {})
      })
    }
  }

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: "Lanjut →",
      prevBtnText: "← Kembali",
      doneBtnText: "Selesai",
      progressText: "{{current}} dari {{total}}",
      steps: [
        {
          element: "#tour-soal-header",
          popover: {
            title: "Input Soal",
            description: "Halaman ini untuk membuat dan mengelola soal ujian. Kamu bisa download soal, kirim ke validator, atau kembali ke dashboard dari header ini.",
            side: "bottom",
          },
        },
        {
          element: "#tour-overall-progress",
          popover: {
            title: "Progress Keseluruhan",
            description: "Menampilkan berapa soal sudah dibuat dari total target semua bab. Progress bar berubah hijau jika semua target terpenuhi.",
            side: "right",
          },
        },
        {
          element: "#tour-bab-nav",
          popover: {
            title: "Navigasi Bab",
            description: "Daftar bab dari matrix yang sudah kamu submit. Klik bab untuk memilih bab aktif. Klik slot (tipe · kesulitan) untuk langsung mengisi form dengan pilihan tersebut.",
            side: "right",
          },
        },
        {
          element: "#tour-form-soal",
          popover: {
            title: "Form Input Soal",
            description: "Form utama untuk membuat soal baru. Pilih bab aktif dari navigasi kiri, lalu isi tipe, kesulitan, dan pertanyaan.",
            side: "left",
          },
        },
        {
          element: "#tour-tipe-kesulitan",
          popover: {
            title: "Tipe & Kesulitan",
            description: "Pilih tipe soal (Pilgan, Ceklist, Essay, Isian Singkat) dan tingkat kesulitan. Bobot soal dihitung otomatis.",
            side: "bottom",
          },
        },
        {
          element: "#tour-editor-pertanyaan",
          popover: {
            title: "Editor Pertanyaan",
            description: "Ketik soal di sini. Toolbar mendukung bold, italic, superscript, subscript, simbol derajat (°), dan pecahan matematika. Gambar juga bisa disisipkan.",
            side: "top",
          },
        },
        {
          element: "#tour-aksi-soal",
          popover: {
            title: "Simpan Soal",
            description: "Klik Simpan untuk menyimpan soal ke database. Jika sedang mengedit soal lama, tombol berubah jadi Update dan muncul tombol Batal Edit.",
            side: "top",
          },
        },
        {
          element: "#tour-soal-list",
          popover: {
            title: "Daftar Soal",
            description: "Soal yang sudah dibuat untuk bab aktif tampil di sini. Klik ikon pensil untuk edit, ikon tong sampah untuk hapus.",
            side: "top",
          },
        },
        {
          element: "#tour-kirim-validator",
          popover: {
            title: "Kirim ke Validator",
            description: "Setelah semua target soal terpenuhi, tombol ini aktif. Klik untuk mengirim soal ke validator untuk direview.",
            side: "bottom",
          },
        },
      ],
    })
    driverObj.drive()
  }, [])

  useEffect(() => {
    if (loading) return
    if (!localStorage.getItem("soal_tour_done")) {
      localStorage.setItem("soal_tour_done", "1")
      setTimeout(() => startTour(), 500)
    }
  }, [loading, startTour])

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--pp-bg)", minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="font-display text-xl" style={{ color: "var(--pp-ink-2)" }}>Memuat...</div>
      </div>
    )
  }

  const allMet = isAllTargetMet()
  const progressPct = totalTarget > 0 ? Math.min(100, Math.round((totalDibuat / totalTarget) * 100)) : 0
  const activeBabSoal = activeBab ? soalList.filter(s => s.bab_id_text === activeBab) : []

  const selectStyle: React.CSSProperties = {
    border: "1.5px solid var(--pp-ink)",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 14,
    color: "var(--pp-ink)",
    backgroundColor: "var(--pp-card)",
    outline: "none",
    width: "100%",
  }

  return (
    <div style={{ backgroundColor: "var(--pp-bg)", minHeight: "100vh" }}>
      {/* Header */}
      <header
        id="tour-soal-header"
        className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--pp-card)", borderBottom: "1.5px solid var(--pp-ink)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div style={{
              width: 40, height: 40, flexShrink: 0,
              backgroundColor: "var(--pp-primary)",
              border: "1.5px dashed rgba(255,255,255,0.45)",
              borderRadius: 12,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span className="font-display font-bold text-sm text-white">S</span>
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-base leading-tight" style={{ color: "var(--pp-ink)" }}>
                Input Soal
              </div>
              {mapelNama && (
                <div className="text-xs leading-tight truncate" style={{ color: "var(--pp-muted)" }}>
                  {mapelNama}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={startTour}
              title="Panduan"
              className="hover:opacity-70 transition-opacity"
              style={{ color: "var(--pp-ink-2)", padding: 6, borderRadius: 8 }}
            >
              <CircleHelp className="w-5 h-5" />
            </button>
            <DownloadDropdown
              soalList={soalList}
              filename={`soal-${mapelNama || "guru"}`}
              meta={{ judul: `Soal ${mapelNama}`, tanggal: new Date().toISOString() }}
            />
            <button
              id="tour-kirim-validator"
              onClick={allMet ? handleKirimValidator : undefined}
              disabled={saving || !allMet}
              onMouseDown={() => allMet && setKirimPressed(true)}
              onMouseUp={() => setKirimPressed(false)}
              onMouseLeave={() => setKirimPressed(false)}
              style={{
                backgroundColor: allMet ? "var(--pp-mint)" : "var(--pp-bg)",
                color: allMet ? "var(--pp-ink)" : "var(--pp-muted)",
                border: `1.5px solid ${allMet ? "var(--pp-ink)" : "var(--pp-line)"}`,
                borderRadius: 12,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: allMet && !kirimPressed ? "3px 3px 0 0 var(--pp-ink)" : "none",
                transform: kirimPressed ? "translate(2px,2px)" : "none",
                transition: "all 80ms",
                cursor: allMet ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {allMet && <Check className="w-3.5 h-3.5" />}
              {saving ? "Mengirim..." : "Kirim ke Validator"}
            </button>
          </div>
        </div>
      </header>

      {/* Back link */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-1">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--pp-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 pb-12 flex gap-5 items-start">

        {/* ── Left Sidebar ── */}
        <div className="w-64 flex-shrink-0 sticky top-20 space-y-4">

          {/* Overall progress */}
          <div
            id="tour-overall-progress"
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "4px 4px 0 0 var(--pp-ink)",
              padding: "16px 20px",
            }}
          >
            <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
              Progress
            </div>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="font-display font-bold text-3xl" style={{ color: "var(--pp-ink)" }}>{totalDibuat}</span>
              <span className="text-sm font-medium" style={{ color: "var(--pp-muted)" }}>/ {totalTarget} soal</span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 6,
                border: "1.5px solid var(--pp-ink)",
                backgroundColor: "var(--pp-bg)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: allMet
                    ? "linear-gradient(90deg, var(--pp-mint), #22c55e)"
                    : "linear-gradient(90deg, var(--pp-lemon), var(--pp-primary))",
                  transition: "width 400ms ease",
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--pp-muted)" }}>{progressPct}%</span>
              {allMet && (
                <span
                  className="text-xs font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--pp-mint)", color: "var(--pp-ink)", border: "1px solid var(--pp-ink)" }}
                >
                  <Check className="w-3 h-3" />
                  Semua terpenuhi
                </span>
              )}
            </div>
          </div>

          {/* Bab navigation */}
          <div
            id="tour-bab-nav"
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "4px 4px 0 0 var(--pp-ink)",
              overflow: "hidden",
            }}
          >
            {matrixData.map((bab, babIdx) => {
              const { done: babDone, total: babTotal } = getBabProgress(bab.bab_id_text)
              const isExpanded = expandedBabs.has(bab.bab_id_text)
              const isActive = activeBab === bab.bab_id_text
              const babAllMet = babTotal > 0 && babDone >= babTotal

              return (
                <div
                  key={bab.bab_id_text}
                  style={{ borderTop: babIdx > 0 ? "1.5px solid var(--pp-ink)" : "none" }}
                >
                  {/* Bab header button */}
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                    style={{ backgroundColor: isActive ? "var(--pp-lemon)" : "transparent" }}
                    onClick={() => {
                      selectBab(bab.bab_id_text)
                      if (!expandedBabs.has(bab.bab_id_text)) toggleBab(bab.bab_id_text)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--pp-ink)" }}>
                        {bab.bab_id_text}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: babAllMet ? "#15803d" : "var(--pp-muted)" }}
                      >
                        {babDone}/{babTotal} soal
                        {babAllMet && " ✓"}
                      </p>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="p-0.5 ml-1 flex-shrink-0"
                      style={{ color: "var(--pp-muted)" }}
                      onClick={e => { e.stopPropagation(); toggleBab(bab.bab_id_text) }}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleBab(bab.bab_id_text) } }}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Slot list */}
                  {isExpanded && (
                    <div
                      className="px-3 pb-3 pt-1 space-y-1"
                      style={{ backgroundColor: "var(--pp-bg)" }}
                    >
                      {TIPE_OPTIONS.flatMap(tipe =>
                        KESULITAN_OPTIONS.map(kesulitan => {
                          const count = getSoalCount(bab.bab_id_text, tipe, kesulitan)
                          const target = getTargetBank(bab.bab_id_text, tipe, kesulitan)
                          if (target === 0) return null
                          const ok = count >= target
                          const isSelected = isActive && selectedTipe === tipe && selectedKesulitan === kesulitan
                          return (
                            <div
                              key={`${tipe}_${kesulitan}`}
                              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: isSelected ? "var(--pp-ink)" : ok ? "#f0fdf4" : "#fef2f2",
                                border: `1px solid ${isSelected ? "var(--pp-ink)" : ok ? "#bbf7d0" : "#fca5a5"}`,
                              }}
                              onClick={() => openSlot(bab.bab_id_text, tipe, kesulitan)}
                            >
                              <span
                                className="capitalize font-medium"
                                style={{ color: isSelected ? "#fff" : ok ? "#15803d" : "#dc2626" }}
                              >
                                {TIPE_LABELS[tipe]} · {kesulitan}
                              </span>
                              <span
                                className="flex items-center gap-0.5 font-semibold"
                                style={{ color: isSelected ? "#fff" : ok ? "#15803d" : "#dc2626" }}
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
        <div className="flex-1 min-w-0 space-y-5">

          {/* Form */}
          <div
            id="tour-form-soal"
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "4px 4px 0 0 var(--pp-ink)",
              overflow: "hidden",
            }}
          >
            {/* Form header band */}
            <div
              style={{
                backgroundColor: editingId ? "var(--pp-peach)" : "var(--pp-lemon)",
                borderBottom: "1.5px solid var(--pp-ink)",
                padding: "12px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div>
                <div className="text-xs font-bold uppercase" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
                  {editingId ? "Mode Edit" : "Tambah Soal"}
                </div>
                <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
                  {activeBab || "Pilih bab terlebih dahulu"}
                </div>
              </div>
              {editingId && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "var(--pp-ink)", color: "#fff" }}
                >
                  Sedang mengedit
                </span>
              )}
            </div>

            {!activeBab ? (
              <div
                className="text-sm text-center"
                style={{ padding: "48px 24px", color: "var(--pp-muted)" }}
              >
                Pilih bab dari navigasi kiri untuk mulai menambah soal
              </div>
            ) : (
              <div style={{ padding: "20px 20px" }} className="space-y-5">

                {/* Tipe */}
                <div id="tour-tipe-kesulitan">
                  <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
                    Tipe Soal
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TIPE_OPTIONS.map(t => {
                      const isSelected = selectedTipe === t
                      const tc = TIPE_COLORS[t]
                      return (
                        <button
                          key={t}
                          onClick={() => { setSelectedTipe(t); setBobot(getDefaultBobot(t, selectedKesulitan)) }}
                          style={{
                            border: "1.5px solid var(--pp-ink)",
                            borderRadius: 20,
                            padding: "6px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            backgroundColor: isSelected ? "var(--pp-ink)" : tc.bg,
                            color: isSelected ? "#fff" : tc.accent,
                            boxShadow: isSelected ? "none" : "2px 2px 0 0 var(--pp-ink)",
                            transition: "all 80ms",
                          }}
                        >
                          {TIPE_LABELS[t]}
                        </button>
                      )
                    })}
                  </div>

                  {/* Kesulitan */}
                  <div className="text-xs font-bold uppercase mt-4 mb-2" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
                    Tingkat Kesulitan
                  </div>
                  <div className="flex gap-2">
                    {KESULITAN_OPTIONS.map(k => {
                      const isSelected = selectedKesulitan === k
                      const kc = KESULITAN_COLORS[k]
                      return (
                        <button
                          key={k}
                          onClick={() => { setSelectedKesulitan(k); setBobot(getDefaultBobot(selectedTipe, k)) }}
                          style={{
                            border: "1.5px solid var(--pp-ink)",
                            borderRadius: 20,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            backgroundColor: isSelected ? "var(--pp-ink)" : kc.bg,
                            color: isSelected ? "#fff" : kc.text,
                            boxShadow: isSelected ? "none" : "2px 2px 0 0 var(--pp-ink)",
                            transition: "all 80ms",
                          }}
                          className="capitalize"
                        >
                          {k}
                        </button>
                      )
                    })}
                    <span
                      className="flex items-center text-xs font-semibold px-3 rounded-full"
                      style={{
                        border: "1.5px solid var(--pp-line)",
                        color: "var(--pp-ink-2)",
                        backgroundColor: "var(--pp-bg)",
                      }}
                    >
                      Bobot: {bobot}
                    </span>
                  </div>
                </div>

                {/* Pertanyaan */}
                <div id="tour-editor-pertanyaan">
                  <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
                    Pertanyaan <span style={{ color: "#dc2626" }}>*</span>
                  </div>
                  <div
                    style={{
                      border: "1.5px solid var(--pp-ink)",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <RichTextEditor
                      content={pertanyaan}
                      onChange={setPertanyaan}
                      placeholder="Masukkan pertanyaan..."
                    />
                  </div>
                </div>

                {/* Pilihan jawaban */}
                {(selectedTipe === "pilgan" || selectedTipe === "ceklist") && (
                  <div>
                    <div className="text-xs font-bold uppercase mb-3" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
                      Pilihan Jawaban
                    </div>
                    <div className="space-y-3">
                      {pilihan.map((p, i) => {
                        const isBenar = selectedTipe === "pilgan"
                          ? jawabanBenar === i
                          : jawabanBenarCeklist.includes(i)
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2"
                            style={{
                              border: `1.5px solid ${isBenar ? "#22c55e" : "var(--pp-line)"}`,
                              borderRadius: 12,
                              padding: "10px 12px",
                              backgroundColor: isBenar ? "#f0fdf4" : "var(--pp-bg)",
                            }}
                          >
                            <div className="mt-2 shrink-0">
                              {selectedTipe === "pilgan" ? (
                                <input
                                  type="radio"
                                  name="jawabanBenar"
                                  checked={jawabanBenar === i}
                                  onChange={() => setJawabanBenar(i)}
                                  style={{ accentColor: "var(--pp-primary)" }}
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
                                  style={{ accentColor: "var(--pp-primary)" }}
                                />
                              )}
                            </div>
                            <span
                              className="mt-2.5 w-5 text-sm font-bold flex-shrink-0"
                              style={{ color: isBenar ? "#15803d" : "var(--pp-muted)" }}
                            >
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
                            <div className="mt-1.5 shrink-0">
                              <ImageUpload
                                value={pilihanGambar[i]}
                                onChange={url => { const n = [...pilihanGambar]; n[i] = url; setPilihanGambar(n) }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div id="tour-aksi-soal" className="flex gap-3 pt-1">
                  <button
                    onClick={handleSaveSoal}
                    disabled={saving}
                    onMouseDown={() => setSavePressed(true)}
                    onMouseUp={() => setSavePressed(false)}
                    onMouseLeave={() => setSavePressed(false)}
                    style={{
                      backgroundColor: "var(--pp-ink)",
                      color: "#fff",
                      border: "1.5px solid var(--pp-ink)",
                      borderRadius: 12,
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      boxShadow: savePressed ? "none" : "3px 3px 0 0 rgba(0,0,0,0.3)",
                      transform: savePressed ? "translate(2px,2px)" : "none",
                      transition: "all 80ms",
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Menyimpan..." : editingId ? "Update Soal" : "Simpan Soal"}
                  </button>
                  {editingId && (
                    <button
                      onClick={resetForm}
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--pp-ink-2)",
                        border: "1.5px solid var(--pp-line)",
                        borderRadius: 12,
                        padding: "10px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Soal list */}
          {activeBab && (
            <div
              id="tour-soal-list"
              style={{
                backgroundColor: "var(--pp-card)",
                border: "1.5px solid var(--pp-ink)",
                borderRadius: 22,
                boxShadow: "4px 4px 0 0 var(--pp-ink)",
                overflow: "hidden",
              }}
            >
              {/* List header */}
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1.5px solid var(--pp-ink)",
                  backgroundColor: "var(--pp-bg)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
                  Daftar Soal — {activeBab}
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--pp-ink)",
                    color: "#fff",
                  }}
                >
                  {activeBabSoal.length} soal
                </span>
              </div>

              {activeBabSoal.length === 0 ? (
                <div
                  className="text-sm text-center"
                  style={{ padding: "48px 24px", color: "var(--pp-muted)" }}
                >
                  Belum ada soal untuk bab ini
                </div>
              ) : (
                <div>
                  {activeBabSoal.map((soal, idx) => {
                    const statusStyle = STATUS_STYLES[soal.status] || STATUS_STYLES["draft"]
                    const tipeColor = TIPE_COLORS[soal.tipe] || TIPE_COLORS["pilgan"]
                    const kesColor = KESULITAN_COLORS[soal.tingkat_kesulitan] || KESULITAN_COLORS["mudah"]
                    const canEdit = soal.status === "draft" || soal.status === "needs_revision" || !soal.status

                    return (
                      <div
                        key={soal.id}
                        style={{
                          padding: "16px 20px",
                          borderTop: idx > 0 ? "1.5px solid var(--pp-line)" : "none",
                          display: "flex", gap: 12, alignItems: "flex-start",
                        }}
                      >
                        {/* Number badge */}
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 font-display"
                          style={{
                            backgroundColor: "var(--pp-lemon)",
                            color: "var(--pp-ink)",
                            border: "1.5px solid var(--pp-ink)",
                          }}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Pills row */}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: tipeColor.bg, color: tipeColor.accent, border: "1px solid var(--pp-ink)" }}
                            >
                              {TIPE_LABELS[soal.tipe] || soal.tipe}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                              style={{ backgroundColor: kesColor.bg, color: kesColor.text, border: "1px solid var(--pp-ink)" }}
                            >
                              {soal.tingkat_kesulitan}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, border: "1px solid var(--pp-line)" }}
                            >
                              {statusStyle.label}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-ink-2)", border: "1px solid var(--pp-line)" }}
                            >
                              Bobot: {soal.bobot}
                            </span>
                          </div>

                          {/* Pertanyaan */}
                          <div
                            className="text-sm rich-html"
                            style={{ color: "var(--pp-ink)" }}
                            dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                          />

                          {/* Pilihan jawaban */}
                          {soal.pilihan && soal.pilihan.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {soal.pilihan.map((p: { id: number; teks: string; benar: boolean }) => (
                                <div
                                  key={p.id}
                                  className="flex items-start gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                                  style={{
                                    backgroundColor: p.benar ? "#f0fdf4" : "var(--pp-bg)",
                                    border: `1px solid ${p.benar ? "#86efac" : "var(--pp-line)"}`,
                                  }}
                                >
                                  <span
                                    className="font-bold flex-shrink-0 mt-0.5"
                                    style={{ color: p.benar ? "#15803d" : "var(--pp-muted)" }}
                                  >
                                    {String.fromCharCode(65 + p.id)}.
                                  </span>
                                  <div
                                    className="flex-1 min-w-0 rich-html"
                                    style={{ color: p.benar ? "#15803d" : "var(--pp-ink)" }}
                                    dangerouslySetInnerHTML={{ __html: p.teks }}
                                  />
                                  {p.benar && <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#15803d" }} />}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Revision notes */}
                          {soal.revision_notes && (
                            <div
                              className="mt-2 text-xs px-3 py-2 rounded-lg"
                              style={{
                                backgroundColor: "#fff0f5",
                                color: "#be123c",
                                border: "1px solid var(--pp-pink)",
                              }}
                            >
                              <span className="font-semibold">Catatan revisi:</span> {soal.revision_notes}
                            </div>
                          )}
                        </div>

                        {/* Edit/Delete */}
                        {canEdit && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEditSoal(soal)}
                              title="Edit"
                              style={{
                                width: 32, height: 32,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "1.5px solid var(--pp-ink)",
                                borderRadius: 8,
                                backgroundColor: "var(--pp-lemon)",
                                color: "var(--pp-ink)",
                                boxShadow: "2px 2px 0 0 var(--pp-ink)",
                                cursor: "pointer",
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSoal(soal.id)}
                              title="Hapus"
                              style={{
                                width: 32, height: 32,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "1.5px solid var(--pp-ink)",
                                borderRadius: 8,
                                backgroundColor: "var(--pp-pink)",
                                color: "var(--pp-ink)",
                                boxShadow: "2px 2px 0 0 var(--pp-ink)",
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
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
