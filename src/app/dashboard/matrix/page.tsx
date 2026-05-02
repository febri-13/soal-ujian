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

export default function MatrixPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [babs, setBabs] = useState<Bab[]>([])
  const [matrixData, setMatrixData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [activeBab, setActiveBab] = useState<string | null>(null)
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
    
    const newBab: Bab = {
      id: newBabName.trim(),
      nama_bab: newBabName.trim(),
    }

    await supabase
      .from("psat_matrix_input")
      .insert({
        profile_id: user.id,
        bab_id: newBabName.trim(),
        data: INITIAL_DATA,
        is_submitted: false,
      })

    setBabs([...babs, newBab])
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
    
    if (activeBab === babId) {
      setActiveBab(null)
    }
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
    
    if (activeBab === oldId) {
      setActiveBab(editBabName.trim())
    }
  }

  const handleFieldChange = (field: string, value: number) => {
    if (!activeBab) return
    setMatrixData({
      ...matrixData,
      [activeBab]: {
        ...matrixData[activeBab],
        [field]: value,
      }
    })
  }

  const handleSave = async () => {
    if (!user || !activeBab || !matrixData[activeBab]) return
    setSaving(true)

    const existing = await supabase
      .from("psat_matrix_input")
      .select("id")
      .eq("profile_id", user.id)
      .eq("bab_id", activeBab)
      .single()

    if (existing.data) {
      await supabase
        .from("psat_matrix_input")
        .update({ data: matrixData[activeBab], updated_at: new Date().toISOString() })
        .eq("id", existing.data.id)
    }

    setSaving(false)
    alert("Disimpan!")
  }

  const handleSubmit = async () => {
    if (!user || !activeBab) return
    setSaving(true)

    await supabase
      .from("psat_matrix_input")
      .update({ is_submitted: true, updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("bab_id", activeBab)

    setSaving(false)
    alert("Matrix submitted!")
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
        {!activeBab ? (
          <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="flex justify-between items-center mb-4">
              <p style={{ color: "var(--color-muted-foreground)" }}>Pilih atau tambah bab:</p>
              <button 
                onClick={() => setIsAdding(true)}
                className="py-1 px-3 rounded text-sm"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                + Tambah Bab
              </button>
            </div>

            {isAdding && (
              <div className="mb-4 p-3 rounded border" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-accent)" }}>
                <input
                  autoFocus
                  type="text"
                  value={newBabName}
                  onChange={(e) => setNewBabName(e.target.value)}
                  placeholder="Nama bab baru..."
                  className="w-full px-3 py-2 mb-2 rounded"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBab()}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddBab} className="py-1 px-3 rounded text-sm" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>Simpan</button>
                  <button onClick={() => { setIsAdding(false); setNewBabName("") }} className="py-1 px-3 rounded text-sm" style={{ borderColor: "var(--color-border)", border: "1px solid" }}>Batal</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {babs.length === 0 && !isAdding && (
                <p style={{ color: "var(--color-muted-foreground)" }}>Belum ada bab. Klik "Tambah Bab" untuk mulai.</p>
              )}
              
              {babs.map((bab) => (
                <div key={bab.id} className="flex items-center gap-2">
                  {editingBab === bab.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editBabName}
                        onChange={(e) => setEditBabName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded"
                        style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameBab(bab.id)}
                      />
                      <button onClick={() => handleRenameBab(bab.id)} className="py-1 px-2 rounded text-sm" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>Simpan</button>
                      <button onClick={() => { setEditingBab(null); setEditBabName("") }} className="py-1 px-2 rounded text-sm" style={{ borderColor: "var(--color-border)", border: "1px solid" }}>Batal</button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveBab(bab.id)}
                        className="flex-1 text-left p-4 rounded-lg border"
                        style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                      >
                        {bab.nama_bab}
                      </button>
                      <button 
                        onClick={() => { setEditingBab(bab.id); setEditBabName(bab.nama_bab) }} 
                        className="p-2 rounded text-sm"
                        style={{ color: "var(--color-muted-foreground)" }}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteBab(bab.id)} 
                        className="p-2 rounded text-sm"
                        style={{ color: "var(--color-destructive)" }}
                        title="Hapus"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setActiveBab(null)} style={{ color: "var(--color-muted-foreground)" }}>
                ← Kembali
              </button>
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-foreground)" }}>{activeBab}</h2>
              <div></div>
            </div>

            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2" style={{ color: "var(--color-foreground)" }}>Tipe</th>
                  <th className="text-center p-2" style={{ color: "var(--color-foreground)" }}>Mudah</th>
                  <th className="text-center p-2" style={{ color: "var(--color-foreground)" }}>Sedang</th>
                  <th className="text-center p-2" style={{ color: "var(--color-foreground)" }}>Sulit</th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {["pilgan", "ceklist", "essay"].map(tipe => (
                  <tr key={tipe}>
                    <td className="p-2 font-medium" style={{ color: "var(--color-foreground)" }}>{tipe.toUpperCase()}</td>
                    {["mudah", "sedang", "sulit"].map(difficulty => (
                      <td key={difficulty} className="p-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs block" style={{ color: "var(--color-muted-foreground)" }}>Keluar</label>
                            <input
                              type="number"
                              min="0"
                              value={(matrixData[activeBab] as any)?.[`${tipe}_${difficulty}_keluar`] || 0}
                              onChange={(e) => handleFieldChange(`${tipe}_${difficulty}_keluar`, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 rounded text-center"
                              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs block" style={{ color: "var(--color-muted-foreground)" }}>Bank</label>
                            <input
                              type="number"
                              min="0"
                              value={(matrixData[activeBab] as any)?.[`${tipe}_${difficulty}_bank`] || 0}
                              onChange={(e) => handleFieldChange(`${tipe}_${difficulty}_bank`, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 rounded text-center"
                              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                            />
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="py-2 px-4 rounded-md font-medium"
                style={{ borderColor: "var(--color-border)", border: "1px solid" }}
              >
                {saving ? "Menyimpan..." : "Simpan Draft"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2 px-4 rounded-md font-medium"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}