"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

interface PsatGuruData {
  id: string
  profile_id: string
  whatsapp: string | null
  no_rekening: string | null
  bank: string | null
  unit_sekolah: string | null
}

const UNIT_OPTIONS = [
  "SMP Al Abidin 1",
  "SMP Al Abidin 2", 
  "SMP Al Abidin 3",
  "SMP Al Abidin 4",
  "SMP Al Abidin 5",
  "SMP Al Abidin 6",
  "SMP Al Abidin 7",
  "SMP Al Abidin 8",
]

const BANK_OPTIONS = [
  "Bank BCA",
  "Bank BRI",
  "Bank BSI",
  "Bank Mandiri",
  "Bank NTT",
  "Bank BTN",
  "Bank Nagari",
  "Bank Aceh",
  "Bank Lain",
]

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [guruData, setGuruData] = useState<PsatGuruData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [whatsapp, setWhatsapp] = useState("")
  const [noRekening, setNoRekening] = useState("")
  const [bank, setBank] = useState("")
  const [unitSekolah, setUnitSekolah] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data } = await supabase
        .from("psat_guru_data")
        .select("*")
        .eq("profile_id", u.id)
        .single()

      if (data) {
        setGuruData(data)
        setWhatsapp(data.whatsapp || "")
        setNoRekening(data.no_rekening || "")
        setBank(data.bank || "")
        setUnitSekolah(data.unit_sekolah || "")
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: existing } = await supabase
      .from("psat_guru_data")
      .select("id")
      .eq("profile_id", user.id)
      .single()

    if (existing) {
      await supabase
        .from("psat_guru_data")
        .update({ 
          whatsapp, 
          no_rekening: noRekening, 
          bank, 
          unit_sekolah: unitSekolah, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", existing.id)
    } else {
      await supabase
        .from("psat_guru_data")
        .insert({ 
          profile_id: user.id, 
          whatsapp, 
          no_rekening: noRekening, 
          bank, 
          unit_sekolah: unitSekolah 
        })
    }

    setSaving(false)
    setSaved(true)
    
    setTimeout(() => {
      router.push("/dashboard")
    }, 1000)
  }

  const handleSkip = () => {
    router.push("/dashboard")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
              ← Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Lengkapi Data Diri</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          {saved && (
            <div className="mb-4 p-3 rounded bg-green-100 border border-green-400" style={{ color: "#166534" }}>
              ✓ Data berhasil disimpan!
            </div>
          )}

          <p className="mb-6" style={{ color: "var(--color-muted-foreground)" }}>
            Silakan lengkapi data diri Anda. Data ini diperlukan untuk keperluan administrasi.
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nomor WhatsApp</label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="0821xxxxxxx"
                className="w-full px-3 py-2 rounded-md"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Unit Sekolah</label>
              <select
                value={unitSekolah}
                onChange={(e) => setUnitSekolah(e.target.value)}
                className="w-full px-3 py-2 rounded-md"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                <option value="">Pilih Unit Sekolah</option>
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Bank</label>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full px-3 py-2 rounded-md"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                <option value="">Pilih Bank</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nomor Rekening</label>
              <input
                type="text"
                value={noRekening}
                onChange={(e) => setNoRekening(e.target.value)}
                placeholder="xxxx-xxxx-xxxx"
                className="w-full px-3 py-2 rounded-md"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 px-4 rounded-md font-medium"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="py-2 px-4 rounded-md font-medium"
                style={{ borderColor: "var(--color-border)", border: "1px solid" }}
              >
                Nanti Saja
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}