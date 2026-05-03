"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import RichTextEditor from "@/components/RichTextEditor"
import ImageUpload from "@/components/ImageUpload"

interface BabMatrix {
  bab_id: string
  data: Record<string, number>
}

const TIPE_OPTIONS = ["pilgan", "ceklist", "isian", "uraian"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

const BOBOT_DEFAULT: Record<string, Record<string, number>> = {
  pilgan: { mudah: 1.0, sedang: 1.5, sulit: 2.0 },
  ceklist: { mudah: 1.5, sedang: 2.0, sulit: 2.5 },
  isian: { mudah: 2.0, sedang: 2.5, sulit: 3.0 },
  uraian: { mudah: 4.0, sedang: 5.5, sulit: 7.5 },
}

export default function SoaresPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrixData, setMatrixData] = useState<BabMatrix[]>([])
  const [soalStats, setSoalStats] = useState<Record<string, number>>({})
  const [selectedBab, setSelectedBab] = useState<string>("")
  const [selectedTipe, setSelectedTipe] = useState<string>("pilgan")
  const [selectedKesulitan, setSelectedKesulitan] = useState<string>("mudah")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"form" | "list">("form")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const [pertanyaan, setPertanyaan] = useState("")
  const [gambarUrl, setGambarUrl] = useState("")
  const [pilihan, setPilihan] = useState<string[]>(["", "", "", ""])
  const [pilihanGambar, setPilihanGambar] = useState<string[]>(["", "", "", ""])
  const [jawabanBenar, setJawabanBenar] = useState<number>(0)
  const [jawabanBenarCeklist, setJawabanBenarCeklist] = useState<number[]>([])
  const [bobot, setBobot] = useState<number>(1.0)
  const [soalList, setSoalList] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data: matrixRows } = await supabase
        .from("psat_matrix_input")
        .select("bab_id,data")
        .eq("profile_id", u.id)
        .eq("is_submitted", true)

if (!matrixRows || matrixRows.length === 0) {
        setToast({ message: "Silakan submit matrix terlebih dahulu", type: "error" })
        setTimeout(() => router.push("/dashboard/matrix"), 1500)
        return
      }

      setMatrixData(matrixRows as BabMatrix[])
      setSelectedBab(matrixRows[0].bab_id)

      const { data: bankSoal } = await supabase
        .from("bank_soal")
        .select("bab_id_text,tipe,tingkat_kesulitan")
        .eq("guru_id", u.id)

      const stats: Record<string, number> = {}
      if (bankSoal) {
        bankSoal.forEach(s => {
          const key = `${s.bab_id_text}_${s.tipe}_${s.tingkat_kesulitan}`
          stats[key] = (stats[key] || 0) + 1
        })
      }
      setSoalStats(stats)

      const { data: allSoal } = await supabase
        .from("bank_soal")
        .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar")
        .eq("guru_id", u.id)
        .order("created_at", { ascending: true })
      if (allSoal) {
        setSoalList(allSoal)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const getDefaultBobot = (tipe: string, kesulitan: string) => {
    return BOBOT_DEFAULT[tipe]?.[kesulitan] || 100
  }

  const handleTipeChange = (tipe: string) => {
    setSelectedTipe(tipe)
    setBobot(getDefaultBobot(tipe, selectedKesulitan))
  }

  const handleKesulitanChange = (kesulitan: string) => {
    setSelectedKesulitan(kesulitan)
    setBobot(getDefaultBobot(selectedTipe, kesulitan))
  }

  const getSoalCount = (babId: string, tipe: string, kesulitan: string) => {
    const key = `${babId}_${tipe}_${kesulitan}`
    return soalStats[key] || 0
  }

  const getTargetBank = (babId: string, tipe: string, kesulitan: string) => {
    const bab = matrixData.find(b => b.bab_id === babId)
    if (!bab?.data) return 0
    return bab.data[`${tipe}_${kesulitan}_bank`] || 0
  }

  const resetForm = () => {
    setPertanyaan("")
    setGambarUrl("")
    setPilihan(["", "", "", ""])
    setPilihanGambar(["", "", "", ""])
    setJawabanBenar(0)
    setJawabanBenarCeklist([])
    setBobot(getDefaultBobot(selectedTipe, selectedKesulitan))
    setEditingId(null)
    setSelectedBab(matrixData[0]?.bab_id || "")
    setSelectedTipe("pilgan")
    setSelectedKesulitan("mudah")
  }

  const handleSaveSoal = async () => {
    if (!user || !selectedBab || !pertanyaan.trim()) {
      setToast({ message: "Pertanyaan wajib diisi", type: "error" })
      return
    }

    const currentCount = getSoalCount(selectedBab, selectedTipe, selectedKesulitan)
    const targetBank = getTargetBank(selectedBab, selectedTipe, selectedKesulitan)
    
    if (!editingId && currentCount >= targetBank) {
      setToast({ message: `Bank soal untuk ${selectedBab} - ${selectedTipe} ${selectedKesulitan} sudah penuh (${currentCount}/${targetBank})`, type: "error" })
      return
    }

    setSaving(true)

    const pilihanObj = selectedTipe === "pilgan" || selectedTipe === "ceklist"
      ? pilihan.map((p, i) => ({ id: i, teks: p, benar: selectedTipe === "ceklist" ? jawabanBenarCeklist.includes(i) : i === jawabanBenar }))
      : null

    if (editingId) {
      const { error } = await supabase.from("bank_soal").update({
        pertanyaan: pertanyaan,
        tipe: selectedTipe,
        bab_id_text: selectedBab,
        level: selectedKesulitan,
        bobot: bobot,
        tingkat_kesulitan: selectedKesulitan,
        pilihan: pilihanObj,
        pilihan_gambar: pilihanGambar.filter(p => p),
        jawaban_benar: selectedTipe === "pilgan" ? jawabanBenar : null,
        updated_at: new Date().toISOString(),
      }).eq("id", editingId)

      setSaving(false)

      if (error) {
        setToast({ message: "Error: " + error.message, type: "error" })
      } else {
        setToast({ message: "Soal berhasil diupdate!", type: "success" })
        const updated = soalList.map(s => s.id === editingId ? { ...s, pertanyaan, tipe: selectedTipe, bab_id_text: selectedBab, tingkat_kesulitan: selectedKesulitan, bobot } : s)
        setSoalList(updated)
        resetForm()
      }
      return
    }

    const { error } = await supabase.from("bank_soal").insert({
      pertanyaan: pertanyaan,
      tipe: selectedTipe,
      guru_id: user.id,
      bab_id_text: selectedBab,
      level: selectedKesulitan,
      bobot: bobot,
      tingkat_kesulitan: selectedKesulitan,
      pilihan: pilihanObj,
      pilihan_gambar: pilihanGambar.filter(p => p),
      jawaban_benar: selectedTipe === "pilgan" ? jawabanBenar : null,
      gambar_url: gambarUrl || null,
    })

    setSaving(false)

    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Soal berhasil disimpan!", type: "success" })
      resetForm()
      
      const key = `${selectedBab}_${selectedTipe}_${selectedKesulitan}`
      setSoalStats(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))

      const { data: newSoal } = await supabase
        .from("bank_soal")
        .select("id,pertanyaan,tipe,tingkat_kesulitan,bobot,bab_id_text,created_at,pilihan,pilihan_gambar")
        .eq("guru_id", user.id)
        .order("created_at", { ascending: true })
      if (newSoal) {
        setSoalList(newSoal)
      }
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh)" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Input Soal</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("form")}
              className={`py-2 px-4 rounded-md ${activeTab === "form" ? "bg-primary text-primary-foreground" : ""}`}
            >
              Form
            </button>
            <button
              onClick={() => setActiveTab("list")}
              className={`py-2 px-4 rounded-md ${activeTab === "list" ? "bg-primary text-primary-foreground" : ""}`}
            >
              Daftar ({soalList.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        {activeTab === "form" ? (
          <>
        <div className="rounded-lg p-6 border mb-6" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>Statistik Input Matrix</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Bab</th>
                  {TIPE_OPTIONS.map(tipe => (
                    <th key={tipe} className="text-center p-2" colSpan={3}>{tipe}</th>
                  ))}
                </tr>
                <tr className="border-b">
                  <th className="p-2"></th>
                  {TIPE_OPTIONS.map(tipe => (
                    KESULITAN_OPTIONS.map(kesulitan => (
                      <th key={`${tipe}_${kesulitan}`} className="text-center p-2">{kesulitan}</th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.map(bab => (
                  <tr key={bab.bab_id} className="border-b">
                    <td className="p-2 font-medium">{bab.bab_id}</td>
                    {TIPE_OPTIONS.map(tipe => (
                      KESULITAN_OPTIONS.map(kesulitan => {
                        const count = getSoalCount(bab.bab_id, tipe, kesulitan)
                        const target = getTargetBank(bab.bab_id, tipe, kesulitan)
                        const isDone = count >= target
                        return (
                          <td key={`${tipe}_${kesulitan}`} className={`text-center p-2 ${isDone ? "text-green-500" : "text-red-500"}`}>
                            {count}/{target}
                          </td>
                        )
                      })
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>{editingId ? "Edit" : "Input"} Soal Baru</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Bab</label>
              <select
                value={selectedBab}
                onChange={e => setSelectedBab(e.target.value)}
                className="w-full p-2 rounded border"
                style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {matrixData.map(b => (
                  <option key={b.bab_id} value={b.bab_id}>{b.bab_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Tipe</label>
              <select
                value={selectedTipe}
                onChange={e => handleTipeChange(e.target.value)}
                className="w-full p-2 rounded border"
                style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {TIPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Tingkat Kesulitan</label>
              <select
                value={selectedKesulitan}
                onChange={e => handleKesulitanChange(e.target.value)}
                className="w-full p-2 rounded border"
                style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {KESULITAN_OPTIONS.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Pertanyaan *</label>
            <RichTextEditor
              content={pertanyaan}
              onChange={setPertanyaan}
              placeholder="Masukkan pertanyaan..."
            />
          </div>

          {(selectedTipe === "pilgan" || selectedTipe === "ceklist") && (
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: "var(--color-muted-foreground)" }}>Pilihan Jawaban</label>
              {pilihan.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
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
                      onChange={e => {
                        if (e.target.checked) {
                          setJawabanBenarCeklist([...jawabanBenarCeklist, i])
                        } else {
                          setJawabanBenarCeklist(jawabanBenarCeklist.filter(idx => idx !== i))
                        }
                      }}
                    />
                  )}
                  <span className="w-6">{String.fromCharCode(65 + i)}.</span>
                  <input
                    type="text"
                    value={p}
                    onChange={e => {
                      const newPilihan = [...pilihan]
                      newPilihan[i] = e.target.value
                      setPilihan(newPilihan)
                    }}
                    placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                    className="flex-1 p-2 rounded border"
                    style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  />
                  <ImageUpload
                    value={pilihanGambar[i]}
                    onChange={(url) => {
                      const newGambar = [...pilihanGambar]
                      newGambar[i] = url
                      setPilihanGambar(newGambar)
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {bobot}</label>
          </div>

          <button
            onClick={handleSaveSoal}
            disabled={saving}
            className="py-2 px-4 rounded-md font-medium"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {saving ? "Menyimpan..." : editingId ? "Update" : "Simpan"}
          </button>
        </div>
          </>
        ) : (
          <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>Daftar soal ({soalList.length})</h2>
            
            {soalList.length === 0 ? (
              <p style={{ color: "var(--color-muted-foreground)" }}>Belum ada soal yang diinput.</p>
            ) : (
              <div className="flex gap-6">
                <div className="w-56 flex-shrink-0">
                  <div className="grid grid-cols-5 gap-1 sticky top-4" style={{ position: "sticky", maxHeight: "calc(100vh - 250px)", overflowY: "auto" }}>
                    {soalList.map((soal, index) => (
                      <button
                        key={soal.id}
                        onClick={() => {
                          document.getElementById(`soal-${soal.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                        }}
                        className="w-8 h-8 border rounded-lg text-center text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
                        style={{ borderColor: "var(--color-border)", color: "var(--color-primary)" }}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  {soalList.map((soal, index) => (
                    <div key={soal.id} id={`soal-${soal.id}`} className="p-4 border rounded-lg flex gap-4" style={{ borderColor: "var(--color-border)" }}>
                      <div className="w-10 h-10 flex-shrink-0 border rounded-lg flex items-center justify-center font-bold" style={{ borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-2">
                            <span className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground">{soal.tipe}</span>
                            <span className="px-2 py-1 text-xs rounded" style={{ backgroundColor: "var(--color-accent)" }}>{soal.tingkat_kesulitan}</span>
                            <span className="px-2 py-1 text-xs rounded" style={{ backgroundColor: "var(--color-accent)" }}>{soal.bab_id_text}</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {soal.bobot}</span>
                            <button
                              onClick={async () => {
                                const { data: soalData } = await supabase
                                  .from("bank_soal")
                                  .select("*")
                                  .eq("id", soal.id)
                                  .single()
                                
                                if (soalData) {
                                  setSelectedBab(soalData.bab_id_text)
                                  setSelectedTipe(soalData.tipe)
                                  setSelectedKesulitan(soalData.tingkat_kesulitan)
                                  setPertanyaan(soalData.pertanyaan)
                                  setBobot(soalData.bobot)
                                  setEditingId(soalData.id)
                                  
if (soalData.pilihan) {
                                      const teksArr = soalData.pilihan.map((p: any) => p.teks || "")
                                      setPilihan(teksArr)
                                      if (soalData.tipe === "pilgan") {
                                        const benarIdx = soalData.pilihan.findIndex((p: any) => p.benar === true)
                                        if (benarIdx >= 0) setJawabanBenar(benarIdx)
                                      } else if (soalData.tipe === "ceklist") {
                                        const benarIdx = soalData.pilihan.filter((p: any) => p.benar === true).map((p: any) => p.id)
                                        setJawabanBenarCeklist(benarIdx || [])
                                      }
                                    }
                                  if (soalData.pilihan_gambar) {
                                    setPilihanGambar(soalData.pilihan_gambar)
                                  }
                                  setActiveTab("form")
                                }
                              }}
                              className="text-blue-500 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm("Yakin hapus soal ini?")) return
                                await supabase.from("bank_soal").delete().eq("id", soal.id)
                                setSoalList(soalList.filter(s => s.id !== soal.id))
                              }}
                              className="text-red-500 text-sm"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                        <div 
                          className="text-sm mb-2"
                          dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                        />
                        {soal.pilihan && soal.pilihan.length > 0 && (
                          <div className="ml-4 mt-2 space-y-1">
                            {soal.pilihan.map((p: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                                <span>{p.teks === "benar" ? "" : p.teks}</span>
                                {p.benar && <span className="text-green-500 text-xs ml-1">(Benar)</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs mt-2" style={{ color: "var(--color-muted-foreground)" }}>
                          {new Date(soal.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}