"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ArrowLeft } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"

interface Dokumen {
  id: string
  tipe: string
  file_url: string | null
  status: string
  versi: number
}

export default function DokumenPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [dokumen, setDokumen] = useState<Dokumen[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data: docs } = await supabase
        .from("psat_dokumen_status")
        .select("*")
        .eq("profile_id", u.id)

      if (docs) {
        setDokumen(docs)
      } else {
        setDokumen([
          { id: "", tipe: "kisi_kisi", file_url: null, status: "belum_upload", versi: 1 },
          { id: "", tipe: "glossary", file_url: null, status: "belum_upload", versi: 1 },
        ])
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleUpload = async (tipe: string, file: File) => {
    if (!user) return
    setUploading(tipe)

    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${tipe}_${Date.now()}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("dokumen-psat")
      .upload(fileName, file)

    if (uploadError) {
      alert("Gagal upload: " + uploadError.message)
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
          updated_at: new Date().toISOString()
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
          versi: 1
        })
    }

    alert("File berhasil diupload!")
    setUploading(null)
    window.location.reload()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  const docTypes = [
    { key: "kisi_kisi", label: "Kisi-kisi Ujian", icon: "📋", desc: "Upload format PDF" },
    { key: "glossary", label: "Glossary", icon: "📖", desc: "Daftar istilah & definisi" },
  ]

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="sticky top-0 z-10" style={{ backgroundColor: "var(--psat-primary)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100" style={{ color: "var(--psat-primary-fg)" }}>
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--psat-primary-fg)" }}>Upload Dokumen</h1>
          </div>
          <div className="[&_button]:bg-transparent [&_button]:border-white/30 [&_button]:text-white">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <p className="mb-6" style={{ color: "var(--color-muted-foreground)" }}>
            Upload dokumen pendukung (opsional):
          </p>

          <div className="space-y-4">
            {docTypes.map(({ key, label, icon, desc }) => {
              const doc = dokumen.find(d => d.tipe === key)
              const isUploaded = doc?.file_url && doc.status !== "belum_upload"

              return (
                <div key={key} className="p-4 rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>
                        {icon} {label}
                      </h3>
                      <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>{desc}</p>
                    </div>
                    {doc?.status && doc.status !== "belum_upload" && (
                      <span 
                        className="text-xs px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: doc.status === "approved" ? "#dcfce7" : "#fef3c7",
                          color: doc.status === "approved" ? "#166534" : "#92400e"
                        }}
                      >
                        {doc.status === "approved" ? "✓ Approved" : 
                         doc.status === "under_review" ? "⏳ Under Review" : 
                         "⚠️ Needs Revision"}
                      </span>
                    )}
                  </div>

                  {isUploaded ? (
                    <div className="flex items-center gap-2">
                      <a 
                        href={doc?.file_url || ""} 
                        target="_blank"
                        className="text-sm underline"
                        style={{ color: "var(--color-primary)" }}
                      >
                        Lihat File ↑
                      </a>
                      <label className="text-sm cursor-pointer underline" style={{ color: "var(--color-muted-foreground)" }}>
                        Ganti File
                        <input 
                          type="file" 
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUpload(key, e.target.files[0])
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="btn py-2 px-4 rounded-md font-medium inline-block" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>
                      {uploading === key ? "Mengupload..." : "Pilih File"}
                      <input 
                        type="file" 
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleUpload(key, e.target.files[0])
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}