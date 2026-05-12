"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, FileText, BookOpen, Upload, ExternalLink, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import Toast from "@/components/Toast"

interface Dokumen {
  id: string
  tipe: string
  file_url: string | null
  status: string
  versi: number
}

const DOC_TYPES = [
  {
    key: "kisi_kisi",
    label: "Kisi-kisi Ujian",
    desc: "Kisi-kisi soal ujian dalam format PDF, DOC, atau DOCX",
    Icon: FileText,
    bg: "#ECE4FF",
    accent: "#6d28d9",
  },
  {
    key: "glossary",
    label: "Glossary",
    desc: "Daftar istilah dan definisi dalam format PDF, DOC, atau DOCX",
    Icon: BookOpen,
    bg: "#DAF5E7",
    accent: "#15803d",
  },
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; Icon: any }> = {
  under_review:   { label: "Sedang Direview", bg: "var(--pp-lemon)", text: "#92400e", Icon: Clock },
  approved:       { label: "Approved",        bg: "var(--pp-mint)",  text: "#15803d", Icon: CheckCircle },
  needs_revision: { label: "Perlu Revisi",    bg: "var(--pp-pink)",  text: "#be123c", Icon: AlertCircle },
}

export default function DokumenPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [dokumen, setDokumen] = useState<Dokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const { data: docs } = await supabase
        .from("psat_dokumen_status")
        .select("*")
        .eq("profile_id", u.id)

      setDokumen(docs ?? [
        { id: "", tipe: "kisi_kisi", file_url: null, status: "belum_upload", versi: 1 },
        { id: "", tipe: "glossary",  file_url: null, status: "belum_upload", versi: 1 },
      ])
      setLoading(false)
    }
    load()
  }, [router])

  const handleUpload = async (tipe: string, file: File) => {
    if (!user) return
    setUploading(tipe)

    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${tipe}_${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("dokumen-psat")
      .upload(fileName, file)

    if (uploadError) {
      setToast({ message: "Gagal upload: " + uploadError.message, type: "error" })
      setUploading(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from("dokumen-psat")
      .getPublicUrl(fileName)

    const existing = dokumen.find(d => d.tipe === tipe)

    if (existing?.id) {
      await supabase
        .from("psat_dokumen_status")
        .update({
          file_url: publicUrl,
          status: "under_review",
          versi: existing.versi + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    } else {
      await supabase
        .from("psat_dokumen_status")
        .insert({
          profile_id: user.id,
          tipe,
          file_url: publicUrl,
          status: "under_review",
          versi: 1,
        })
    }

    // Refresh state without page reload
    const { data: updatedDocs } = await supabase
      .from("psat_dokumen_status")
      .select("*")
      .eq("profile_id", user.id)
    if (updatedDocs) setDokumen(updatedDocs)

    setToast({ message: "File berhasil diupload!", type: "success" })
    setUploading(null)
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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div style={{
              width: 40, height: 40, flexShrink: 0,
              backgroundColor: "var(--pp-primary)",
              border: "1.5px dashed rgba(255,255,255,0.45)",
              borderRadius: 12,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span className="font-display font-bold text-sm text-white">D</span>
            </div>
            <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
              Upload Dokumen
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Back link */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-1">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--pp-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-12 space-y-4">
        {/* Info banner */}
        <div
          style={{
            backgroundColor: "var(--pp-lemon)",
            border: "1.5px solid var(--pp-ink)",
            borderRadius: 16,
            padding: "12px 18px",
            boxShadow: "3px 3px 0 0 var(--pp-ink)",
            fontSize: 14,
            color: "var(--pp-ink-2)",
          }}
        >
          Upload dokumen pendukung di bawah ini. Dokumen bersifat opsional dan akan direview oleh admin.
        </div>

        {/* Document cards */}
        {DOC_TYPES.map(({ key, label, desc, Icon, bg, accent }) => {
          const doc = dokumen.find(d => d.tipe === key)
          const isUploaded = !!(doc?.file_url && doc.status !== "belum_upload")
          const statusCfg = doc?.status ? STATUS_CONFIG[doc.status] : null
          const isUploadingThis = uploading === key

          return (
            <div
              key={key}
              style={{
                backgroundColor: "var(--pp-card)",
                border: "1.5px solid var(--pp-ink)",
                borderRadius: 22,
                boxShadow: "4px 4px 0 0 var(--pp-ink)",
                overflow: "hidden",
              }}
            >
              {/* Card header band */}
              <div
                style={{
                  backgroundColor: bg,
                  borderBottom: "1.5px solid var(--pp-ink)",
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 40, height: 40,
                      backgroundColor: "var(--pp-card)",
                      border: "1.5px solid var(--pp-ink)",
                      borderRadius: 12,
                      boxShadow: "2px 2px 0 0 var(--pp-ink)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
                      {label}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--pp-muted)" }}>
                      {desc}
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                {statusCfg && (
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      backgroundColor: statusCfg.bg,
                      color: statusCfg.text,
                      border: "1.5px solid var(--pp-ink)",
                    }}
                  >
                    <statusCfg.Icon className="w-3 h-3" />
                    {statusCfg.label}
                  </span>
                )}
              </div>

              {/* Card body */}
              <div style={{ padding: "20px 20px" }}>
                {isUploaded ? (
                  /* Uploaded state */
                  <div className="space-y-3">
                    {/* Version info */}
                    {doc && doc.versi > 1 && (
                      <div
                        className="text-xs font-medium px-2.5 py-1 rounded-full inline-block"
                        style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-muted)", border: "1px solid var(--pp-line)" }}
                      >
                        Versi {doc.versi}
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* View file */}
                      <a
                        href={doc?.file_url || ""}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-semibold"
                        style={{
                          backgroundColor: "var(--pp-card)",
                          color: "var(--pp-ink)",
                          border: "1.5px solid var(--pp-ink)",
                          borderRadius: 10,
                          padding: "8px 14px",
                          boxShadow: "2px 2px 0 0 var(--pp-ink)",
                          textDecoration: "none",
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Lihat File
                      </a>

                      {/* Replace file */}
                      <label
                        className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                        style={{
                          color: "var(--pp-ink-2)",
                          border: "1.5px dashed var(--pp-ink)",
                          borderRadius: 10,
                          padding: "8px 14px",
                          opacity: isUploadingThis ? 0.5 : 1,
                        }}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isUploadingThis ? "animate-spin" : ""}`} />
                        {isUploadingThis ? "Mengupload..." : "Ganti File"}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          disabled={isUploadingThis}
                          onChange={e => { if (e.target.files?.[0]) handleUpload(key, e.target.files[0]) }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  /* Upload drop zone */
                  <label
                    className="flex flex-col items-center justify-center gap-3 cursor-pointer"
                    style={{
                      border: "1.5px dashed var(--pp-ink)",
                      borderRadius: 16,
                      padding: "32px 24px",
                      backgroundColor: isUploadingThis ? "var(--pp-bg)" : "transparent",
                      opacity: isUploadingThis ? 0.6 : 1,
                      transition: "background-color 150ms",
                    }}
                  >
                    <div
                      style={{
                        width: 52, height: 52,
                        backgroundColor: bg,
                        border: "1.5px solid var(--pp-ink)",
                        borderRadius: 16,
                        boxShadow: "2px 2px 0 0 var(--pp-ink)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {isUploadingThis
                        ? <RefreshCw className="w-6 h-6 animate-spin" style={{ color: accent }} />
                        : <Upload className="w-6 h-6" style={{ color: accent }} />
                      }
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold" style={{ color: "var(--pp-ink)" }}>
                        {isUploadingThis ? "Mengupload..." : "Klik untuk pilih file"}
                      </div>
                      <div className="text-xs mt-1" style={{ color: "var(--pp-muted)" }}>
                        PDF, DOC, atau DOCX
                      </div>
                    </div>
                    <div
                      className="text-xs font-semibold px-4 py-2 rounded-full"
                      style={{
                        backgroundColor: "var(--pp-ink)",
                        color: "#fff",
                        boxShadow: isUploadingThis ? "none" : "2px 2px 0 0 rgba(0,0,0,0.3)",
                        pointerEvents: "none",
                      }}
                    >
                      {isUploadingThis ? "Mohon tunggu..." : "Pilih File"}
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      disabled={isUploadingThis}
                      onChange={e => { if (e.target.files?.[0]) handleUpload(key, e.target.files[0]) }}
                    />
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
