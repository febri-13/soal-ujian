"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { CheckCircle, Clock, AlertCircle, ArrowLeft } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import DownloadDropdown from "@/components/DownloadDropdown"

interface MapelSummary {
  id: string
  nama: string
  kode: string | null
  submitted: number
  needs_revision: number
  approved: number
}

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
  const [validatorMapelIds, setValidatorMapelIds] = useState<string[] | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, nama, no_hp")
        .eq("id", u.id)
        .single()

      if (!profile || !["admin", "validator"].includes(profile.role)) {
        setToast({ message: "Akses ditolak", type: "error" })
        setTimeout(() => router.push("/dashboard"), 1500)
        return
      }

      if (profile.role === "validator") {
        const { data: guruData } = await supabase
          .from("psat_guru_data")
          .select("bank, no_rekening, unit_sekolah")
          .eq("profile_id", u.id)
          .maybeSingle()

        const missingFields: string[] = []
        if (!profile.nama || profile.nama === u.id) missingFields.push("Nama")
        if (!profile.no_hp) missingFields.push("No HP")
        if (!guruData?.unit_sekolah) missingFields.push("Unit Sekolah")
        if (!guruData?.bank) missingFields.push("Bank")
        if (!guruData?.no_rekening) missingFields.push("No Rekening")

        if (missingFields.length > 0) {
          setToast({ message: `Lengkapi profil dulu: ${missingFields.join(", ")}`, type: "info" })
          setTimeout(() => router.push("/dashboard/profile"), 1500)
          return
        }
      }

      setUser({ ...u, nama: profile.nama })

      let assignedMapelIds: string[] | null = null
      if (profile.role === "validator") {
        const { data: vmRows } = await supabase
          .from("psat_validator_mapel")
          .select("mapel_id")
          .eq("validator_id", u.id)
        assignedMapelIds = vmRows?.map((r: any) => r.mapel_id) ?? []
        setValidatorMapelIds(assignedMapelIds)
      }

      const { data: mapelList } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama", { ascending: true })

      const { data: soalCounts } = await supabase
        .from("bank_soal")
        .select("mata_pelajaran_id, status")
        .in("status", ["submitted", "needs_revision", "approved"])

      if (mapelList && soalCounts) {
        let summaries: MapelSummary[] = mapelList.map(m => ({
          id: m.id,
          nama: m.nama,
          kode: m.kode,
          submitted: soalCounts.filter(s => s.mata_pelajaran_id === m.id && s.status === "submitted").length,
          needs_revision: soalCounts.filter(s => s.mata_pelajaran_id === m.id && s.status === "needs_revision").length,
          approved: soalCounts.filter(s => s.mata_pelajaran_id === m.id && s.status === "approved").length,
        })).filter(m => m.submitted + m.needs_revision + m.approved > 0)

        if (assignedMapelIds !== null) {
          summaries = summaries.filter(m => assignedMapelIds!.includes(m.id))
        }

        setMapelSummaries(summaries)

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

    const { data: soal, error: soalError } = await supabase
      .from("bank_soal")
      .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar,status,revision_notes,revision_history,guru_id")
      .eq("mata_pelajaran_id", mapel.id)
      .in("status", ["submitted", "needs_revision", "approved"])
      .order("created_at", { ascending: true })

    if (soalError) {
      setToast({ message: "Gagal memuat soal: " + soalError.message, type: "error" })
    } else {
      setSoalList(soal ?? [])
    }
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

      if (newStatus === "needs_revision" && currentSoal?.guru_id && selectedMapel) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return
          fetch("/api/notifications/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              type: "needs_revision",
              guruId: currentSoal.guru_id,
              mapelNama: selectedMapel.nama,
              catatanRevisi: notes || "Mohon periksa kembali soal Anda.",
            }),
          }).catch(() => {})
        })
      }
    }
  }

  const getRevisionNotes = (notes: string | null) => {
    if (!notes) return ""
    if (notes.includes("Approved")) return "Approved"
    const match = notes.match(/^\[([^\]]+)\]\s*(.*)/)
    return match ? match[2] : notes
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--pp-bg)", minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="font-display text-xl" style={{ color: "var(--pp-ink-2)" }}>Memuat...</div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "var(--pp-bg)", minHeight: "100vh" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--pp-card)", borderBottom: "1.5px solid var(--pp-ink)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <div style={{
              width: 40, height: 40, flexShrink: 0,
              backgroundColor: "var(--pp-primary)",
              border: "1.5px dashed rgba(255,255,255,0.45)",
              borderRadius: 12,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span className="font-display font-bold text-sm text-white">V</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
                Validasi Soal
              </span>
              {selectedMapel && (
                <>
                  <span style={{ color: "var(--pp-line)", fontSize: 18 }}>/</span>
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--pp-muted)" }}
                  >
                    {selectedMapel.nama}
                  </span>
                </>
              )}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Back link */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-1">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--pp-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </button>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-4 pb-12 space-y-6">

        {/* Mapel grid */}
        <div>
          <div className="text-xs font-bold uppercase mb-3" style={{ color: "var(--pp-muted)", letterSpacing: "0.12em" }}>
            Pilih Mata Pelajaran
          </div>

          {validatorMapelIds !== null && validatorMapelIds.length === 0 ? (
            <div
              style={{
                border: "1.5px dashed var(--pp-ink)",
                borderRadius: 22,
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--pp-muted)",
              }}
            >
              Belum ada mata pelajaran yang ditugaskan. Hubungi admin.
            </div>
          ) : mapelSummaries.length === 0 ? (
            <div
              style={{
                border: "1.5px dashed var(--pp-ink)",
                borderRadius: 22,
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--pp-muted)",
              }}
            >
              Belum ada soal yang disubmit.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {mapelSummaries.map(m => {
                const isActive = selectedMapel?.id === m.id
                const hasPending = m.submitted + m.needs_revision > 0
                const allApproved = m.approved > 0 && m.submitted === 0 && m.needs_revision === 0

                let cardBg = "var(--pp-card)"
                if (isActive) cardBg = "var(--pp-lemon)"
                else if (hasPending) cardBg = "#FFF0E6"
                else if (allApproved) cardBg = "#EDFAF3"

                return (
                  <button
                    key={m.id}
                    onClick={() => openMapel(m)}
                    className="text-left"
                    style={{
                      backgroundColor: cardBg,
                      border: "1.5px solid var(--pp-ink)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      boxShadow: isActive ? "none" : "3px 3px 0 0 var(--pp-ink)",
                      transform: isActive ? "translate(2px,2px)" : "none",
                      transition: "all 100ms",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-start justify-between gap-1 mb-2.5">
                      <span className="text-sm font-semibold leading-snug" style={{ color: "var(--pp-ink)" }}>
                        {m.nama}
                      </span>
                      {m.kode && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                          style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-muted)", border: "1px solid var(--pp-line)" }}
                        >
                          {m.kode}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.submitted > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "var(--pp-lemon)", color: "#92400e", border: "1px solid var(--pp-ink)" }}
                        >
                          <Clock className="w-3 h-3" /> {m.submitted}
                        </span>
                      )}
                      {m.needs_revision > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "var(--pp-pink)", color: "#be123c", border: "1px solid var(--pp-ink)" }}
                        >
                          <AlertCircle className="w-3 h-3" /> {m.needs_revision}
                        </span>
                      )}
                      {m.approved > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "var(--pp-mint)", color: "#15803d", border: "1px solid var(--pp-ink)" }}
                        >
                          <CheckCircle className="w-3 h-3" /> {m.approved}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Soal list */}
        {selectedMapel && (
          <div
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "6px 6px 0 0 var(--pp-ink)",
              overflow: "hidden",
            }}
          >
            {/* List header */}
            <div
              style={{
                backgroundColor: "var(--pp-lemon)",
                borderBottom: "1.5px solid var(--pp-ink)",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div className="text-xs font-bold uppercase" style={{ color: "var(--pp-muted)", letterSpacing: "0.1em" }}>
                  Daftar Soal
                </div>
                <div className="font-display font-semibold text-lg" style={{ color: "var(--pp-ink)" }}>
                  {selectedMapel.nama}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedMapel.submitted > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "var(--pp-lemon)", color: "#92400e", border: "1.5px solid var(--pp-ink)" }}>
                    <Clock className="w-3.5 h-3.5" /> {selectedMapel.submitted} menunggu
                  </span>
                )}
                {selectedMapel.needs_revision > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "var(--pp-pink)", color: "#be123c", border: "1.5px solid var(--pp-ink)" }}>
                    <AlertCircle className="w-3.5 h-3.5" /> {selectedMapel.needs_revision} revisi
                  </span>
                )}
                {selectedMapel.approved > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "var(--pp-mint)", color: "#15803d", border: "1.5px solid var(--pp-ink)" }}>
                    <CheckCircle className="w-3.5 h-3.5" /> {selectedMapel.approved} approved
                  </span>
                )}
                {!loadingSoal && soalList.length > 0 && (
                  <DownloadDropdown
                    soalList={soalList}
                    filename={`soal-${selectedMapel.nama}`}
                    meta={{ judul: `Soal ${selectedMapel.nama}`, tanggal: new Date().toISOString() }}
                  />
                )}
              </div>
            </div>

            {loadingSoal ? (
              <div className="p-10 text-center" style={{ color: "var(--pp-muted)" }}>
                Memuat soal...
              </div>
            ) : soalList.length === 0 ? (
              <div className="p-10 text-center" style={{ color: "var(--pp-muted)" }}>
                Belum ada soal untuk mata pelajaran ini.
              </div>
            ) : (
              <div>
                {soalList.map((soal, index) => {
                  const tipeColor = TIPE_COLORS[soal.tipe] || TIPE_COLORS["pilgan"]
                  const kesColor = KESULITAN_COLORS[soal.tingkat_kesulitan] || KESULITAN_COLORS["mudah"]

                  const statusStyle =
                    soal.status === "approved"      ? { bg: "var(--pp-mint)",  text: "#15803d",  label: "Approved" } :
                    soal.status === "needs_revision" ? { bg: "var(--pp-pink)",  text: "#be123c",  label: "Revisi" } :
                                                       { bg: "var(--pp-lemon)", text: "#92400e",  label: "Dikirim" }

                  const rowBg = index % 2 === 0 ? "var(--pp-card)" : "var(--pp-bg)"

                  return (
                    <div
                      key={soal.id}
                      style={{
                        borderTop: index > 0 ? "1.5px solid var(--pp-line)" : "none",
                        padding: "20px 24px",
                        backgroundColor: rowBg,
                      }}
                    >
                      {/* Top row: pills + status */}
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Number badge */}
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display shrink-0"
                            style={{
                              backgroundColor: "var(--pp-lemon)",
                              color: "var(--pp-ink)",
                              border: "1.5px solid var(--pp-ink)",
                            }}
                          >
                            {index + 1}
                          </span>
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
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-ink-2)", border: "1px solid var(--pp-line)" }}
                          >
                            {soal.bab_id_text}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-muted)", border: "1px solid var(--pp-line)" }}
                          >
                            Bobot: {soal.bobot}
                          </span>
                        </div>
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0"
                          style={{
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                            border: "1.5px solid var(--pp-ink)",
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </div>

                      {/* Pertanyaan */}
                      <div
                        className="text-sm rich-html mb-3"
                        style={{ color: "var(--pp-ink)", paddingLeft: 4 }}
                        dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                      />

                      {/* Pilihan */}
                      {soal.pilihan && soal.pilihan.length > 0 && (
                        <div className="mb-3 space-y-1.5 pl-1">
                          {soal.pilihan.map((p: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs rounded-lg px-2.5 py-1.5"
                              style={{
                                backgroundColor: p.benar ? "#f0fdf4" : "var(--pp-bg)",
                                border: `1px solid ${p.benar ? "#86efac" : "var(--pp-line)"}`,
                              }}
                            >
                              <span
                                className="font-bold shrink-0 mt-0.5"
                                style={{ color: p.benar ? "#15803d" : "var(--pp-muted)" }}
                              >
                                {String.fromCharCode(65 + i)}.
                              </span>
                              <span
                                className="rich-html flex-1"
                                style={{ color: p.benar ? "#15803d" : "var(--pp-ink)" }}
                                dangerouslySetInnerHTML={{ __html: p.teks || "" }}
                              />
                              {p.benar && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                                  style={{ backgroundColor: "var(--pp-mint)", color: "#15803d" }}
                                >
                                  Benar
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Catatan revisi sebelumnya */}
                      {soal.revision_notes && (
                        <div
                          className="mb-3 px-3 py-2 rounded-lg text-xs pl-1"
                          style={{
                            backgroundColor: soal.status === "approved" ? "#f0fdf4" : "#fff0f5",
                            border: `1px solid ${soal.status === "approved" ? "#86efac" : "var(--pp-pink)"}`,
                            color: soal.status === "approved" ? "#15803d" : "#be123c",
                            marginLeft: 4,
                          }}
                        >
                          <span className="font-semibold">
                            {soal.revision_notes.match(/^\[([^\]]+)\]/)?.[1] || "Validator"}:
                          </span>{" "}
                          {getRevisionNotes(soal.revision_notes)}
                        </div>
                      )}

                      {/* History */}
                      {soal.revision_history && soal.revision_history.length > 1 && (
                        <details className="mb-3 pl-1">
                          <summary
                            className="text-xs cursor-pointer font-medium"
                            style={{ color: "var(--pp-muted)" }}
                          >
                            Lihat riwayat ({soal.revision_history.length} catatan)
                          </summary>
                          <div className="mt-2 space-y-1">
                            {soal.revision_history.map((h: string, i: number) => (
                              <div
                                key={i}
                                className="text-xs px-2.5 py-1.5 rounded-lg"
                                style={{
                                  backgroundColor: "var(--pp-bg)",
                                  border: "1px solid var(--pp-line)",
                                  color: "var(--pp-ink-2)",
                                }}
                              >
                                {h}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Action area */}
                      <div className="flex gap-3 items-start pl-1">
                        <textarea
                          value={revisionNotes[soal.id] ?? ""}
                          onChange={e => setRevisionNotes(prev => ({ ...prev, [soal.id]: e.target.value }))}
                          placeholder="Catatan revisi (opsional untuk approve)..."
                          rows={2}
                          className="flex-1 text-sm resize-none"
                          style={{
                            border: "1.5px solid var(--pp-ink)",
                            borderRadius: 10,
                            padding: "8px 12px",
                            backgroundColor: "var(--pp-card)",
                            color: "var(--pp-ink)",
                            outline: "none",
                          }}
                          onFocus={e => { e.target.style.borderColor = "var(--pp-primary)"; e.target.style.boxShadow = "2px 2px 0 0 var(--pp-primary)" }}
                          onBlur={e => { e.target.style.borderColor = "var(--pp-ink)"; e.target.style.boxShadow = "none" }}
                        />
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => handleStatusChange(soal.id, "needs_revision")}
                            disabled={saving}
                            style={{
                              backgroundColor: "var(--pp-pink)",
                              color: "var(--pp-ink)",
                              border: "1.5px solid var(--pp-ink)",
                              borderRadius: 10,
                              padding: "8px 14px",
                              fontSize: 13,
                              fontWeight: 600,
                              boxShadow: "2px 2px 0 0 var(--pp-ink)",
                              cursor: saving ? "not-allowed" : "pointer",
                              opacity: saving ? 0.6 : 1,
                              display: "flex", alignItems: "center", gap: 5,
                            }}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Revisi
                          </button>
                          <button
                            onClick={() => handleStatusChange(soal.id, "approved")}
                            disabled={saving}
                            style={{
                              backgroundColor: "var(--pp-mint)",
                              color: "var(--pp-ink)",
                              border: "1.5px solid var(--pp-ink)",
                              borderRadius: 10,
                              padding: "8px 14px",
                              fontSize: 13,
                              fontWeight: 600,
                              boxShadow: "2px 2px 0 0 var(--pp-ink)",
                              cursor: saving ? "not-allowed" : "pointer",
                              opacity: saving ? 0.6 : 1,
                              display: "flex", alignItems: "center", gap: 5,
                            }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        </div>
                      </div>

                      {/* Tanggal */}
                      <div className="mt-2 pl-1 text-xs" style={{ color: "var(--pp-muted)" }}>
                        {new Date(soal.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
