"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import RichTextEditor from "@/components/RichTextEditor"

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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const [pertanyaan, setPertanyaan] = useState("")
  const [gambarUrl, setGambarUrl] = useState("")
  const [pilihan, setPilihan] = useState<string[]>(["", "", "", ""])
  const [jawabanBenar, setJawabanBenar] = useState<number>(0)
  const [bobot, setBobot] = useState<number>(1.0)

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

      setMatrixData(matrixRows)
      setSelectedBab(matrixRows[0].bab_id)

      const { data: bankSoal } = await supabase
        .from("bank_soal")
        .select("bab_id,tipe,tingkat_kesulitan")
        .eq("guru_id", u.id)

      const stats: Record<string, number> = {}
      if (bankSoal) {
        bankSoal.forEach(s => {
          const key = `${s.bab_id}_${s.tipe}_${s.tingkat_kesulitan}`
          stats[key] = (stats[key] || 0) + 1
        })
      }
      setSoalStats(stats)

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

  const handleSaveSoal = async () => {
    if (!user || !selectedBab || !pertanyaan.trim()) {
      setToast({ message: "Pertanyaan wajib diisi", type: "error" })
      return
    }

    setSaving(true)

    const pilihanObj = selectedTipe === "pilgan" || selectedTipe === "ceklist"
      ? pilihan.map((p, i) => ({ id: i, teks: p, benar: selectedTipe === "ceklist" ? pilihan[i] === "benar" : i === jawabanBenar }))
      : null

    const { error } = await supabase.from("bank_soal").insert({
      pertanyaan: pertanyaan,
      tipe: selectedTipe,
      guru_id: user.id,
      bab_id: selectedBab,
      level: selectedKesulitan,
      bobot: bobot,
      tingkat_kesulitan: selectedKesulitan,
      pilihan: pilihanObj,
      jawaban_benar: selectedTipe === "pilgan" ? jawabanBenar : null,
      gambar_url: gambarUrl || null,
    })

    setSaving(false)

    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" })
    } else {
      setToast({ message: "Soal berhasil disimpan!", type: "success" })
      setPertanyaan("")
      setGambarUrl("")
      setPilihan(["", "", "", ""])
      setJawabanBenar(0)
      setBobot(getDefaultBobot(selectedTipe, selectedKesulitan))
      
      const key = `${selectedBab}_${selectedTipe}_${selectedKesulitan}`
      setSoalStats(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        {/* Statistik Matrix */}
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

        {/* Form Input */}
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-foreground)" }}>Input Soal Baru</h2>
          
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
                      checked={p === "benar"}
                      onChange={e => {
                        const newPilihan = [...pilihan]
                        newPilihan[i] = e.target.checked ? "benar" : ""
                        setPilihan(newPilihan)
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
                </div>
              ))}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>URL Gambar (opsional)</label>
            <input
              type="text"
              value={gambarUrl}
              onChange={e => setGambarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full p-2 rounded border"
              style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1" style={{ color: "var(--color-muted-foreground)" }}>Bobot: {bobot}</label>
          </div>

          <button
            onClick={handleSaveSoal}
            disabled={saving}
            className="py-2 px-4 rounded-md font-medium"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
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