"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { Plus, Pencil, Trash2, X, BookMarked, ArrowLeft } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"

interface MapelSimple {
  id: string
  nama: string
  kode: string | null
  deskripsi: string | null
}

export default function AdminMapelPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mapelList, setMapelList] = useState<MapelSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null)
  const [selectedMapel, setSelectedMapel] = useState<MapelSimple | null>(null)
  const [formNama, setFormNama] = useState("")
  const [formKode, setFormKode] = useState("")
  const [formDeskripsi, setFormDeskripsi] = useState("")
  const [formError, setFormError] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingMapel, setDeletingMapel] = useState<MapelSimple | null>(null)

  useEffect(() => { checkAuthAndLoad() }, [router])

  const checkAuthAndLoad = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { router.push("/login"); return }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", u.id).single()
    if (!profile || profile.role !== "admin") {
      setToast({ message: "Akses ditolak", type: "error" })
      setTimeout(() => router.push("/dashboard"), 1500)
      return
    }
    setUser(u)
    await loadMapel()
  }

  const loadMapel = async () => {
    setLoading(true)
    try {
      const { data: mapels, error } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode, deskripsi")
        .order("nama", { ascending: true })
      if (error) throw error
      setMapelList(mapels || [])
    } catch (err: any) {
      setToast({ message: err.message || "Gagal memuat data", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setModalMode("add"); setSelectedMapel(null)
    setFormNama(""); setFormKode(""); setFormDeskripsi(""); setFormError("")
  }

  const openEditModal = (mapel: MapelSimple) => {
    setModalMode("edit"); setSelectedMapel(mapel)
    setFormNama(mapel.nama); setFormKode(mapel.kode || "")
    setFormDeskripsi(mapel.deskripsi || ""); setFormError("")
  }

  const closeModal = () => { setModalMode(null); setSelectedMapel(null); setFormError("") }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSaving(true)
    const trimmedNama = formNama.trim()
    if (!trimmedNama) { setFormError("Nama mata pelajaran wajib diisi"); setSaving(false); return }
    try {
      const payload = { nama: trimmedNama, kode: formKode.trim() || null, deskripsi: formDeskripsi.trim() || null }
      if (modalMode === "add") {
        const { error: createError } = await supabase.from("mata_pelajaran").insert(payload).select("id, nama, kode, deskripsi").single()
        if (createError) {
          if (createError.code === "23505") { setFormError(`"${trimmedNama}" sudah ada`); setSaving(false); return }
          throw createError
        }
        setToast({ message: "Mata pelajaran berhasil ditambahkan", type: "success" })
        closeModal(); loadMapel()
      } else {
        const { error: updateError } = await supabase.from("mata_pelajaran").update(payload).eq("id", selectedMapel!.id).select("id, nama, kode, deskripsi").single()
        if (updateError) {
          if (updateError.code === "23505") { setFormError(`"${trimmedNama}" sudah ada`); setSaving(false); return }
          throw updateError
        }
        setToast({ message: "Mata pelajaran berhasil diperbarui", type: "success" })
        closeModal(); loadMapel()
      }
    } catch (err: any) {
      setFormError(err.message || "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = async (mapel: MapelSimple) => {
    setDeletingMapel(mapel); setShowDeleteModal(true); setFormError("")
    try {
      const [guruRes, soalRes, patokanRes, bobotRes, validatorRes] = await Promise.all([
        supabase.from("psat_guru_data").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
        supabase.from("bank_soal").select("id", { count: "exact", head: true }).eq("mata_pelajaran_id", mapel.id),
        supabase.from("psat_patokan_soal").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
        supabase.from("bobot_config").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
        supabase.from("psat_validator_mapel").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
      ])
      const totalDeps = (guruRes.count || 0) + (soalRes.count || 0) + (patokanRes.count || 0) + (bobotRes.count || 0) + (validatorRes.count || 0)
      if (totalDeps > 0) {
        setFormError(`blocked|${guruRes.count || 0}|${soalRes.count || 0}|${patokanRes.count || 0}|${bobotRes.count || 0}|${validatorRes.count || 0}`)
      }
    } catch (err) {
      console.error("Dependency check error:", err)
    }
  }

  const handleDelete = async () => {
    if (!deletingMapel) return
    setDeleting(true)
    try {
      const { error } = await supabase.from("mata_pelajaran").delete().eq("id", deletingMapel.id)
      if (error) {
        if (error.code === "23503") setFormError("delete_blocked")
        throw error
      }
      setToast({ message: "Mata pelajaran berhasil dihapus", type: "success" })
      setShowDeleteModal(false); setDeletingMapel(null); loadMapel()
    } catch (err: any) {
      if (err.code === "23503") setFormError("delete_blocked")
      else setFormError(err.message || "Gagal menghapus")
      setDeleting(false)
    }
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
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--pp-card)", borderBottom: "1.5px solid var(--pp-ink)" }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div style={{
              width: 40, height: 40, flexShrink: 0,
              backgroundColor: "var(--pp-primary)",
              border: "1.5px dashed rgba(255,255,255,0.45)",
              borderRadius: 12,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BookMarked className="w-4 h-4 text-white" />
            </div>
            <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
              Mata Pelajaran
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-[10px]"
              style={{
                backgroundColor: "var(--pp-mint)",
                color: "#15803d",
                border: "1.5px solid var(--pp-ink)",
                boxShadow: "3px 3px 0 0 var(--pp-ink)",
              }}
            >
              <Plus className="w-4 h-4" />
              Tambah Mapel
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 pb-1">
        <a
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--pp-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </a>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-4 pb-12">
        {mapelList.length === 0 ? (
          <div
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "4px 4px 0 0 var(--pp-ink)",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div style={{
              width: 52, height: 52,
              backgroundColor: "var(--pp-bg)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 16,
              boxShadow: "2px 2px 0 0 var(--pp-ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <BookMarked className="w-6 h-6" style={{ color: "var(--pp-muted)" }} />
            </div>
            <p className="font-display font-semibold" style={{ color: "var(--pp-ink)" }}>Belum Ada Mata Pelajaran</p>
            <p className="text-sm mt-1" style={{ color: "var(--pp-muted)" }}>Klik "Tambah Mapel" untuk membuat.</p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "6px 6px 0 0 var(--pp-ink)",
              overflow: "hidden",
            }}
          >
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ backgroundColor: "var(--pp-lemon)", borderBottom: "1.5px solid var(--pp-ink)" }}>
                  <th className="px-5 py-3 text-left font-display font-semibold" style={{ color: "var(--pp-ink)" }}>Nama</th>
                  <th className="px-4 py-3 text-left font-display font-semibold" style={{ color: "var(--pp-ink)" }}>Kode</th>
                  <th className="px-4 py-3 text-left font-display font-semibold" style={{ color: "var(--pp-ink)" }}>Deskripsi</th>
                  <th className="px-4 py-3 text-center font-display font-semibold" style={{ color: "var(--pp-ink)" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {mapelList.map((mapel, idx) => (
                  <tr
                    key={mapel.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "var(--pp-card)" : "var(--pp-bg)",
                      borderBottom: "1px solid var(--pp-line)",
                    }}
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold text-sm" style={{ color: "var(--pp-ink)" }}>{mapel.nama}</div>
                    </td>
                    <td className="px-4 py-3">
                      {mapel.kode ? (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "var(--pp-lemon)", color: "var(--pp-ink)", border: "1px solid var(--pp-ink)" }}
                        >
                          {mapel.kode}
                        </span>
                      ) : (
                        <span style={{ color: "var(--pp-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs truncate max-w-[200px]" style={{ color: "var(--pp-muted)" }}>
                        {mapel.deskripsi || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(mapel)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px]"
                          style={{
                            backgroundColor: "var(--pp-lemon)",
                            color: "#92400e",
                            border: "1.5px solid var(--pp-ink)",
                            boxShadow: "2px 2px 0 0 var(--pp-ink)",
                          }}
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(mapel)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px]"
                          style={{
                            backgroundColor: "var(--pp-pink)",
                            color: "#be123c",
                            border: "1.5px solid var(--pp-ink)",
                            boxShadow: "2px 2px 0 0 var(--pp-ink)",
                          }}
                          title="Hapus"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg"
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "6px 6px 0 0 var(--pp-ink)",
              overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              backgroundColor: modalMode === "add" ? "var(--pp-mint)" : "var(--pp-lemon)",
              borderBottom: "1.5px solid var(--pp-ink)",
              padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
                {modalMode === "add" ? "Tambah Mata Pelajaran" : "Edit Mata Pelajaran"}
              </div>
              <button onClick={closeModal} style={{ color: "var(--pp-ink-2)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--pp-ink)" }}>
                    Nama Mata Pelajaran <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formNama}
                    onChange={e => setFormNama(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] text-sm"
                    style={{
                      backgroundColor: "var(--pp-bg)",
                      border: formError && !formNama.trim() ? "1.5px solid #dc2626" : "1.5px solid var(--pp-ink)",
                      color: "var(--pp-ink)",
                      outline: "none",
                    }}
                    onFocus={e => { e.currentTarget.style.boxShadow = "2px 2px 0 0 var(--pp-primary)" }}
                    onBlur={e => { e.currentTarget.style.boxShadow = "none" }}
                    placeholder="Contoh: Matematika"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--pp-ink)" }}>
                    Kode{" "}
                    <span style={{ color: "var(--pp-muted)", fontWeight: 400 }}>(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={formKode}
                    onChange={e => setFormKode(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] text-sm"
                    style={{
                      backgroundColor: "var(--pp-bg)",
                      border: "1.5px solid var(--pp-ink)",
                      color: "var(--pp-ink)",
                      outline: "none",
                    }}
                    onFocus={e => { e.currentTarget.style.boxShadow = "2px 2px 0 0 var(--pp-primary)" }}
                    onBlur={e => { e.currentTarget.style.boxShadow = "none" }}
                    placeholder="Contoh: MTK"
                    maxLength={20}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--pp-ink)" }}>
                    Deskripsi{" "}
                    <span style={{ color: "var(--pp-muted)", fontWeight: 400 }}>(opsional)</span>
                  </label>
                  <textarea
                    value={formDeskripsi}
                    onChange={e => setFormDeskripsi(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] text-sm"
                    style={{
                      backgroundColor: "var(--pp-bg)",
                      border: "1.5px solid var(--pp-ink)",
                      color: "var(--pp-ink)",
                      outline: "none",
                      resize: "vertical",
                    }}
                    onFocus={e => { e.currentTarget.style.boxShadow = "2px 2px 0 0 var(--pp-primary)" }}
                    onBlur={e => { e.currentTarget.style.boxShadow = "none" }}
                    placeholder="Deskripsi singkat..."
                    rows={3}
                  />
                </div>

                {formError && (
                  <p className="text-sm" style={{ color: "#dc2626" }}>{formError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2 px-4 rounded-[10px] text-sm font-semibold"
                    style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-ink)", border: "1.5px solid var(--pp-ink)" }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 px-4 rounded-[10px] text-sm font-semibold disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--pp-ink)",
                      color: "#fff",
                      border: "1.5px solid var(--pp-ink)",
                      boxShadow: "3px 3px 0 0 rgba(0,0,0,0.35)",
                    }}
                  >
                    {saving ? "Menyimpan..." : modalMode === "add" ? "Tambah" : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingMapel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError("") }}
        >
          <div
            className="w-full max-w-md"
            style={{
              backgroundColor: "var(--pp-card)",
              border: "1.5px solid var(--pp-ink)",
              borderRadius: 22,
              boxShadow: "6px 6px 0 0 var(--pp-ink)",
              overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              backgroundColor: "var(--pp-pink)",
              borderBottom: "1.5px solid var(--pp-ink)",
              padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" style={{ color: "#be123c" }} />
                <div className="font-display font-semibold text-base" style={{ color: "var(--pp-ink)" }}>
                  Hapus Mata Pelajaran
                </div>
              </div>
              <button
                onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError("") }}
                style={{ color: "var(--pp-ink-2)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {formError && formError.startsWith("blocked|") ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold" style={{ color: "#be123c" }}>
                    Tidak dapat menghapus — masih digunakan:
                  </p>
                  <div className="space-y-1.5">
                    {(() => {
                      const parts = formError.split("|")
                      const [, guru, soal, patokan, bobot, validator] = parts
                      return [
                        Number(guru) > 0 && { label: `${guru} guru terdaftar`, blocked: true },
                        Number(soal) > 0 && { label: `${soal} soal bank`, blocked: true },
                        Number(patokan) > 0 && { label: `${patokan} entri patokan`, blocked: true },
                        Number(bobot) > 0 && { label: `${bobot} konfigurasi bobot (akan terhapus otomatis)`, blocked: false },
                        Number(validator) > 0 && { label: `${validator} penugasan validator (akan terhapus otomatis)`, blocked: false },
                      ].filter(Boolean).map((item: any, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-[8px] text-xs font-medium"
                          style={{
                            backgroundColor: item.blocked ? "var(--pp-pink)" : "var(--pp-lemon)",
                            color: item.blocked ? "#be123c" : "#92400e",
                            border: "1px solid var(--pp-ink)",
                          }}
                        >
                          {item.label}
                        </div>
                      ))
                    })()}
                  </div>
                  <p className="text-xs" style={{ color: "var(--pp-muted)" }}>
                    Hapus atau pindahkan data terkait terlebih dahulu.
                  </p>
                </div>
              ) : formError === "delete_blocked" ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold" style={{ color: "#be123c" }}>
                    Gagal menghapus: data terikat masih ada.
                  </p>
                  <p className="text-xs" style={{ color: "var(--pp-muted)" }}>
                    Hapus atau reassign data guru, soal, patokan, bobot, dan validator terlebih dahulu.
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--pp-ink)" }}>
                  Apakah Anda yakin ingin menghapus <strong>{deletingMapel?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4" style={{ borderTop: "1.5px solid var(--pp-ink)" }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError("") }}
                className="flex-1 py-2 px-4 rounded-[10px] text-sm font-semibold"
                style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-ink)", border: "1.5px solid var(--pp-ink)" }}
              >
                {formError ? "Kembali" : "Batal"}
              </button>
              {!formError && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 px-4 rounded-[10px] text-sm font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--pp-pink)",
                    color: "#be123c",
                    border: "1.5px solid var(--pp-ink)",
                    boxShadow: "3px 3px 0 0 var(--pp-ink)",
                  }}
                >
                  {deleting ? "Menghapus..." : "Hapus"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
