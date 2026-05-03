"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

interface Bab {
  id: string
  nama_bab: string
}

const INITIAL_DATA = {
  pilgan_mudah_keluar: 0,
  pilgan_mudah_bank: 0,
  pilgan_sedang_keluar: 0,
  pilgan_sedang_bank: 0,
  pilgan_sulit_keluar: 0,
  pilgan_sulit_bank: 0,
  ceklist_mudah_keluar: 0,
  ceklist_mudah_bank: 0,
  ceklist_sedang_keluar: 0,
  ceklist_sedang_bank: 0,
  ceklist_sulit_keluar: 0,
  ceklist_sulit_bank: 0,
  essay_mudah_keluar: 0,
  essay_mudah_bank: 0,
  essay_sedang_keluar: 0,
  essay_sedang_bank: 0,
  essay_sulit_keluar: 0,
  essay_sulit_bank: 0,
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "essay"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

export default function MatrixPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [babs, setBabs] = useState<Bab[]>([])
  const [matrixData, setMatrixData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [isAdding, setIsAdding] = useState(false)
  const [newBabName, setNewBabName] = useState("")
  const [editingBab, setEditingBab] = useState<string | null>(null)
  const [editBabName, setEditBabName] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data: existingBabs } = await supabase
        .from("psat_matrix_input")
        .select("bab_id, data, is_submitted")
        .eq("profile_id", u.id)

      if (existingBabs && existingBabs.length > 0) {
        setBabs(existingBabs.map(b => ({ id: b.bab_id, nama_bab: b.bab_id || "Bab" })))
        const dataMap: Record<string, any> = {}
        existingBabs.forEach(b => {
          dataMap[b.bab_id] = b.data || INITIAL_DATA
        })
        setMatrixData(dataMap)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleAddBab = async () => {
    if (!newBabName.trim() || !user) return

    await supabase
      .from("psat_matrix_input")
      .insert({
        profile_id: user.id,
        bab_id: newBabName.trim(),
        data: INITIAL_DATA,
        is_submitted: false,
      })

    setBabs([...babs, { id: newBabName.trim(), nama_bab: newBabName.trim() }])
    setMatrixData({ ...matrixData, [newBabName.trim()]: INITIAL_DATA })
    setNewBabName("")
    setIsAdding(false)
  }

  const handleDeleteBab = async (babId: string) => {
    if (!confirm(`Hapus "${babId}"? Data matrix akan hilang.`)) return

    await supabase
      .from("psat_matrix_input")
      .delete()
      .eq("profile_id", user.id)
      .eq("bab_id", babId)

    setBabs(babs.filter(b => b.id !== babId))
    const newData = { ...matrixData }
    delete newData[babId]
    setMatrixData(newData)
  }

  const handleRenameBab = async (oldId: string) => {
    if (!editBabName.trim() || !user) return

    await supabase
      .from("psat_matrix_input")
      .update({
        bab_id: editBabName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("profile_id", user.id)
      .eq("bab_id", oldId)

    const newData = { ...matrixData }
    newData[editBabName.trim()] = newData[oldId]
    delete newData[oldId]

    setBabs(babs.map(b => b.id === oldId ? { ...b, id: editBabName.trim(), nama_bab: editBabName.trim() } : b))
    setMatrixData(newData)
    setEditingBab(null)
    setEditBabName("")
  }

  const handleFieldChange = (babId: string, field: string, value: number) => {
    setMatrixData({
      ...matrixData,
      [babId]: {
        ...matrixData[babId],
        [field]: value,
      }
    })
  }

  const handleSave = async (babId: string) => {
    if (!user || !matrixData[babId]) return

    await supabase
      .from("psat_matrix_input")
      .update({ data: matrixData[babId], updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("bab_id", babId)
  }

  const handleSubmit = async (babId: string) => {
    if (!user) return
    setSaving(true)

    await supabase
      .from("psat_matrix_input")
      .update({ is_submitted: true, updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("bab_id", babId)

    setSaving(false)
    alert(`Matrix "${babId}" submitted!`)
  }

  const handleSubmitAll = async () => {
    if (!user) return
    setSaving(true)

    for (const bab of babs) {
      await supabase
        .from("psat_matrix_input")
        .update({ is_submitted: true, updated_at: new Date().toISOString() })
        .eq("profile_id", user.id)
        .eq("bab_id", bab.id)
    }

    setSaving(false)
    alert("Semua matrix submitted!")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
              ← Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Input Matrix</h1>
            <div></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        {/* Header Tambah Bab */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex gap-2 overflow-x-auto">
            {babs.map((bab) => (
              <div key={bab.id} className="flex items-center gap-1">
                {editingBab === bab.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editBabName}
                    onChange={(e) => setEditBabName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameBab(bab.id)}
                    onBlur={() => handleRenameBab(bab.id)}
                    className="px-2 py-1 rounded text-sm w-24"
                    style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  />
                ) : (
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium cursor-pointer"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
                    onClick={() => { setEditingBab(bab.id); setEditBabName(bab.nama_bab) }}
                  >
                    {bab.nama_bab}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteBab(bab.id)}
                  className="text-xs"
                  style={{ color: "var(--color-destructive)" }}
                  title="Hapus"
                >
                  ×
                </button>
              </div>
            ))}

            {isAdding ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newBabName}
                  onChange={(e) => setNewBabName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBab()}
                  onBlur={() => { if (!newBabName) setIsAdding(false) }}
                  placeholder="Nama bab..."
                  className="px-2 py-1 rounded text-sm w-24"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                />
                <button onClick={handleAddBab} className="text-sm" style={{ color: "var(--color-primary)" }}>✓</button>
                <button onClick={() => { setIsAdding(false); setNewBabName("") }} className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>×</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="px-3 py-1 rounded-full text-sm border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
              >
                + Tambah
              </button>
            )}
          </div>
        </div>

        {/* Table Matrix */}
        {babs.length === 0 ? (
          <div className="rounded-lg p-8 border text-center" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <p style={{ color: "var(--color-muted-foreground)" }}>
              Klik "+ Tambah" untuk menambah bab/chapter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-center border" rowSpan={2} style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}>
                    Tipe
                  </th>
                  <th className="p-2 text-center border" rowSpan={2} style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}>
                    Tingkat
                  </th>
                  {babs.map((bab) => (
                    <th key={bab.id} className="p-2 text-center border" colSpan={2} style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}>
                      {bab.nama_bab}
                    </th>
                  ))}
                </tr>
                <tr>
                  {babs.flatMap((bab) => [
                    <th key={`${bab.id}-soal`} className="p-1 text-center border text-xs" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}>
                      soal
                    </th>,
                    <th key={`${bab.id}-bank`} className="p-1 text-center border text-xs" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}>
                      bank
                    </th>
                  ])}
                </tr>
              </thead>
              <tbody>
                {TIPE_OPTIONS.map(tipe => (
                  KESULITAN_OPTIONS.map((kesulitan, idx) => (
                    <tr key={`${tipe}-${kesulitan}`}>
                      {idx === 0 && (
                        <td rowSpan={3} className="p-2 border font-medium text-center" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}>
                          {tipe.toUpperCase()}
                        </td>
                      )}
                      <td className="p-2 border text-center capitalize" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}>
                        {kesulitan}
                      </td>
                      {babs.flatMap((bab) => [
                        <td key={`${bab.id}-keluar`} className="p-1 border" style={{ borderColor: "var(--color-border)" }}>
                          <input
                            type="number"
                            min="0"
                            value={(matrixData[bab.id] as any)?.[`${tipe}_${kesulitan}_keluar`] || 0}
                            onChange={(e) => handleFieldChange(bab.id, `${tipe}_${kesulitan}_keluar`, parseInt(e.target.value) || 0)}
                            onBlur={() => handleSave(bab.id)}
                            className="w-full px-1 py-1 rounded text-center text-sm"
                            style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        </td>,
                        <td key={`${bab.id}-bank`} className="p-1 border" style={{ borderColor: "var(--color-border)" }}>
                          <input
                            type="number"
                            min="0"
                            value={(matrixData[bab.id] as any)?.[`${tipe}_${kesulitan}_bank`] || 0}
                            onChange={(e) => handleFieldChange(bab.id, `${tipe}_${kesulitan}_bank`, parseInt(e.target.value) || 0)}
                            onBlur={() => handleSave(bab.id)}
                            className="w-full px-1 py-1 rounded text-center text-sm"
                            style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                          />
                        </td>
                      ])}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Submit All */}
        {babs.length > 0 && (
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={handleSubmitAll}
              disabled={saving}
              className="py-2 px-4 rounded-md font-medium"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              Submit Semua
            </button>
          </div>
        )}
      </main>
    </div>
  )
}