"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { Plus, Pencil, Trash2, X } from "lucide-react"
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

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null)
  const [selectedMapel, setSelectedMapel] = useState<MapelSimple | null>(null)
  const [formNama, setFormNama] = useState("")
  const [formKode, setFormKode] = useState("")
  const [formDeskripsi, setFormDeskripsi] = useState("")
  const [formError, setFormError] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingMapel, setDeletingMapel] = useState<MapelSimple | null>(null)
  const [cascadeInfo, setCascadeInfo] = useState<{ patokan: number; bobot: number; validator: number } | null>(null)

  useEffect(() => {
    checkAuthAndLoad()
  }, [router])

  const checkAuthAndLoad = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { router.push("/login"); return }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", u.id)
      .single()

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
      console.error("Load mapel error:", err)
      setToast({ message: err.message || "Gagal memuat data", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setModalMode("add")
    setSelectedMapel(null)
    setFormNama("")
    setFormKode("")
    setFormDeskripsi("")
    setFormError("")
  }

  const openEditModal = (mapel: MapelSimple) => {
    setModalMode("edit")
    setSelectedMapel(mapel)
    setFormNama(mapel.nama)
    setFormKode(mapel.kode || "")
    setFormDeskripsi(mapel.deskripsi || "")
    setFormError("")
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedMapel(null)
    setFormError("")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSaving(true)

    const trimmedNama = formNama.trim()
    if (!trimmedNama) {
      setFormError("Nama mata pelajaran wajib diisi")
      setSaving(false)
      return
    }

    try {
      const payload = {
        nama: trimmedNama,
        kode: formKode.trim() || null,
        deskripsi: formDeskripsi.trim() || null,
      }

      if (modalMode === "add") {
        const { data: newMapel, error: createError } = await supabase
          .from("mata_pelajaran")
          .insert(payload)
          .select("id, nama, kode, deskripsi")
          .single()

        if (createError) {
          if (createError.code === "23505") { // unique violation
            setFormError(`Mata pelajaran "${trimmedNama}" sudah ada`)
            setSaving(false)
            return
          }
          throw createError
        }

        setToast({ message: "Mata pelajaran berhasil ditambahkan", type: "success" })
        closeModal()
        loadMapel()
      } else {
        const { data: updatedMapel, error: updateError } = await supabase
          .from("mata_pelajaran")
          .update(payload)
          .eq("id", selectedMapel!.id)
          .select("id, nama, kode, deskripsi")
          .single()

        if (updateError) {
          if (updateError.code === "23505") {
            setFormError(`Mata pelajaran "${trimmedNama}" sudah ada`)
            setSaving(false)
            return
          }
          throw updateError
        }

        setToast({ message: "Mata pelajaran berhasil diperbarui", type: "success" })
        closeModal()
        loadMapel()
      }
    } catch (err: any) {
      console.error("Save mapel error:", err)
      setFormError(err.message || "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = async (mapel: MapelSimple) => {
    setDeletingMapel(mapel)
    setShowDeleteModal(true)
    setFormError("")
    setCascadeInfo(null)

    try {
      const [guruRes, soalRes, patokanRes, bobotRes, validatorRes] = await Promise.all([
        supabase.from("psat_guru_data").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
        supabase.from("bank_soal").select("id", { count: "exact", head: true }).eq("mata_pelajaran_id", mapel.id),
        supabase.from("psat_patokan_soal").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
        supabase.from("bobot_config").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
        supabase.from("psat_validator_mapel").select("id", { count: "exact", head: true }).eq("mapel_id", mapel.id),
      ])

      const guruCount = guruRes.count || 0
      const soalCount = soalRes.count || 0
      const patokanCount = patokanRes.count || 0
      const bobotCount = bobotRes.count || 0
      const validatorCount = validatorRes.count || 0

      // Only block if guru or soal exist (they must be reassigned first)
      if (guruCount > 0 || soalCount > 0) {
        setFormError(`blocked|${guruCount}|${soalCount}`)
      }

      // Patokan, bobot, validator will be cascade-deleted automatically
      if (patokanCount > 0 || bobotCount > 0 || validatorCount > 0) {
        setCascadeInfo({ patokan: patokanCount, bobot: bobotCount, validator: validatorCount })
      }
    } catch (err) {
      console.error("Dependency check error:", err)
    }
  }

  const handleDelete = async () => {
    if (!deletingMapel) return
    setDeleting(true)

    try {
      // Delete cascade-able related data first
      await Promise.all([
        supabase.from("psat_patokan_soal").delete().eq("mapel_id", deletingMapel.id),
        supabase.from("bobot_config").delete().eq("mapel_id", deletingMapel.id),
        supabase.from("psat_validator_mapel").delete().eq("mapel_id", deletingMapel.id),
      ])

      const { error } = await supabase
        .from("mata_pelajaran")
        .delete()
        .eq("id", deletingMapel.id)

      if (error) {
        if (error.code === "23503") {
          setFormError("delete_blocked")
        }
        throw error
      }

      setToast({ message: "Mata pelajaran berhasil dihapus", type: "success" })
      setShowDeleteModal(false)
      setDeletingMapel(null)
      setCascadeInfo(null)
      loadMapel()
    } catch (err: any) {
      console.error("Delete mapel error:", err)
      if (err.code === "23503") {
        setFormError("delete_blocked")
      } else {
        setFormError(err.message || "Gagal menghapus")
      }
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <p style={{ color: "var(--color-muted-foreground)" }}>Memuat...</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="sticky top-0 z-10" style={{ backgroundColor: "var(--psat-primary)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/dashboard/admin" className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100" style={{ color: "var(--psat-primary-fg)" }}>
              ← Admin
            </a>
            <h1 className="text-xl font-bold" style={{ color: "var(--psat-primary-fg)" }}>Mata Pelajaran</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="[&_button]:bg-transparent [&_button]:border-white/30 [&_button]:text-white">
              <ThemeToggle />
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              <Plus className="w-4 h-4" />
              Tambah Mapel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        {mapelList.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--color-muted-foreground)" }}>
            Belum ada mata pelajaran. Klik "Tambah Mapel" untuk membuat.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "var(--color-muted)" }}>
                <tr>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-muted-foreground)" }}>Nama</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-muted-foreground)" }}>Kode</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-muted-foreground)" }}>Deskripsi</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: "var(--color-muted-foreground)" }}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {mapelList.map((mapel, idx) => (
                  <tr key={mapel.id} style={{ backgroundColor: idx % 2 === 0 ? "var(--color-card)" : "var(--color-muted)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--color-foreground)" }}>{mapel.nama}</div>
                    </td>
                    <td className="px-4 py-3">
                      {mapel.kode ? (
                        <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                          {mapel.kode}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-muted-foreground)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs truncate max-w-[200px]" style={{ color: "var(--color-muted-foreground)" }}>
                        {mapel.deskripsi || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(mapel)}
                          className="p-1.5 rounded border"
                          style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(mapel)}
                          className="p-1.5 rounded"
                          style={{ color: "#dc2626" }}
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border shadow-xl overflow-y-auto max-h-[90vh]"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
              <div>
                <h2 className="font-semibold text-base" style={{ color: "var(--color-foreground)" }}>
                  {modalMode === "add" ? "Tambah Mata Pelajaran" : "Edit Mata Pelajaran"}
                </h2>
              </div>
              <button onClick={closeModal} style={{ color: "var(--color-muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Nama */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>
                  Nama Mata Pelajaran <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={e => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border text-sm"
                  style={{
                    backgroundColor: "var(--color-input)",
                    borderColor: formError && !formNama.trim() ? "#dc2626" : "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  placeholder="Contoh: Matematika"
                  autoFocus
                />
              </div>

              {/* Kode */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>
                  Kode (opsional)
                </label>
                <input
                  type="text"
                  value={formKode}
                  onChange={e => setFormKode(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border text-sm"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  placeholder="Contoh: MTK"
                  maxLength={20}
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={formDeskripsi}
                  onChange={e => setFormDeskripsi(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border text-sm"
                  style={{
                    backgroundColor: "var(--color-input)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  placeholder="Deskripsi singkat..."
                  rows={3}
                />
              </div>

              {formError && (
                <p className="text-sm" style={{ color: "#dc2626" }}>{formError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 px-4 rounded-md text-sm font-medium border"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                >
                  {saving ? "Menyimpan..." : modalMode === "add" ? "Tambah" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingMapel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError(""); setCascadeInfo(null) }}
        >
          <div
            className="w-full max-w-md rounded-xl border shadow-xl"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
              <h2 className="font-semibold text-base flex items-center gap-2" style={{ color: "var(--color-foreground)" }}>
                <Trash2 className="w-4 h-4" style={{ color: "#dc2626" }} />
                Hapus Mata Pelajaran
              </h2>
              <button onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError(""); setCascadeInfo(null) }} style={{ color: "var(--color-muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {formError && formError.startsWith("blocked|") ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
                    Tidak dapat menghapus karena masih ada data terikat:
                  </p>
                  <ul className="text-sm list-disc list-inside space-y-1" style={{ color: "var(--color-muted-foreground)" }}>
                    {(() => {
                      const [, guru, soal] = formError.split("|")
                      return [
                        Number(guru) > 0 && `${guru} guru terdaftar`,
                        Number(soal) > 0 && `${soal} soal bank`,
                      ].filter(Boolean)
                    })()}
                  </ul>
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    Hapus atau pindahkan data guru dan soal yang terkait terlebih dahulu.
                  </p>
                </div>
              ) : formError === "delete_blocked" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
                    Gagal menghapus: masih ada data terikat di database.
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    Hapus atau reassign data guru dan soal yang terkait terlebih dahulu.
                  </p>
                </div>
              ) : formError ? (
                <p className="text-sm" style={{ color: "#dc2626" }}>{formError}</p>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                  Apakah Anda yakin ingin menghapus <strong>{deletingMapel?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
              )}

              {cascadeInfo && !formError.startsWith("blocked|") && (
                <div className="rounded-md px-3 py-2 text-xs space-y-0.5" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                  <p className="font-medium">Data berikut akan ikut dihapus otomatis:</p>
                  {cascadeInfo.patokan > 0 && <p>• {cascadeInfo.patokan} entri patokan soal</p>}
                  {cascadeInfo.bobot > 0 && <p>• {cascadeInfo.bobot} konfigurasi bobot</p>}
                  {cascadeInfo.validator > 0 && <p>• {cascadeInfo.validator} penugasan validator</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError(""); setCascadeInfo(null) }}
                className="flex-1 py-2 px-4 rounded-md text-sm font-medium border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                Batal
              </button>
              {formError.startsWith("blocked|") || formError === "delete_blocked" ? (
                <button
                  onClick={() => { setShowDeleteModal(false); setDeletingMapel(null); setFormError(""); setCascadeInfo(null) }}
                  className="flex-1 py-2 px-4 rounded-md text-sm font-medium"
                  style={{ backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}
                >
                  Kembali
                </button>
              ) : (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
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
