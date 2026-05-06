"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"

interface PsatGuruData {
  id: string
  profile_id: string
  whatsapp: string | null
  no_rekening: string | null
  bank: string | null
  unit_sekolah: string | null
  mapel_id: string | null
}

interface MataPelajaran {
  id: string
  nama: string
  kode: string
}

const UNIT_OPTIONS = [
  "SMP I Al Abidin Surakarta",
  "SMP ABBS Surakarta",
  "SMPII Al Abidin Karanganyar",
  "SMPII Al Abidin Sukoharjo",
  "SMPII Al Abidin Klaten",
  "SMPII Al Abidin Boyolali",
  "SMPII Al Abidin Yogyakarta",
  "SMPII Al Abidin Salatiga",
]

const BANK_OPTIONS = [
  "CIMB",
  "MayBank",
]

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [guruData, setGuruData] = useState<PsatGuruData | null>(null)
  const [mataPelajaran, setMataPelajaran] = useState<MataPelajaran[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const [nama, setNama] = useState("")
  const [noHp, setNoHp] = useState("")
  const [noRekening, setNoRekening] = useState("")
  const [bank, setBank] = useState("")
  const [unitSekolah, setUnitSekolah] = useState("")
  const [kelas, setKelas] = useState("")
  const [mapelId, setMapelId] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data: mapelData } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama")

      if (mapelData) {
        setMataPelajaran(mapelData)
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single()

      if (!profileData) {
        await supabase.from("profiles").insert({
          id: u.id,
          email: u.email,
        })
      }

      setNama(profileData?.nama || u.user_metadata?.nama || "")
      setNoHp(profileData?.no_hp || u.user_metadata?.no_hp || "")
      setKelas(profileData?.kelas || "")

      const { data } = await supabase
        .from("psat_guru_data")
        .select("*")
        .eq("profile_id", u.id)
        .maybeSingle()

      if (data) {
        setGuruData(data)
        setNoRekening(data.no_rekening || "")
        setBank(data.bank || "")
        setUnitSekolah(data.unit_sekolah || "")
        setMapelId(data.mapel_id || "")
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const fieldErrors = {
      nama: !nama.trim(),
      noHp: !noHp.trim(),
      unitSekolah: !unitSekolah,
      kelas: !kelas,
      mapelId: !mapelId,
      bank: !bank,
      noRekening: !noRekening.trim(),
    }
    setErrors(fieldErrors)

    if (Object.values(fieldErrors).some(Boolean)) {
      setToast({ message: "Lengkapi semua field yang ditandai merah.", type: "error" })
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ nama, no_hp: noHp, kelas })
      .eq("id", user.id)

    if (profileError) {
      setToast({ message: "Gagal simpan profil: " + profileError.message, type: "error" })
      setSaving(false)
      return
    }

    const { data: existing } = await supabase
      .from("psat_guru_data")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle()

    let guruError
    if (existing) {
      const { error } = await supabase
        .from("psat_guru_data")
        .update({
          whatsapp: noHp,
          no_rekening: noRekening,
          bank,
          unit_sekolah: unitSekolah,
          mapel_id: mapelId || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id)
      guruError = error
    } else {
      const { error } = await supabase
        .from("psat_guru_data")
        .insert({
          profile_id: user.id,
          whatsapp: noHp,
          no_rekening: noRekening,
          bank,
          unit_sekolah: unitSekolah,
          mapel_id: mapelId || null
        })
      guruError = error
    }

    setSaving(false)

    if (guruError) {
      setToast({ message: "Gagal simpan data guru: " + guruError.message, type: "error" })
      return
    }

    setToast({ message: "Data berhasil disimpan!", type: "success" })
    setTimeout(() => {
      router.push("/dashboard")
    }, 1500)
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
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Profil Saya</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>

          <p className="mb-6" style={{ color: "var(--color-muted-foreground)" }}>
            Lengkapi atau perbarui data diri Anda.
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.nama ? "#dc2626" : "var(--color-foreground)" }}>Nama Lengkap</label>
              <input
                type="text"
                value={nama}
                onChange={(e) => { setNama(e.target.value); setErrors(p => ({ ...p, nama: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.nama ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Email</label>
              <input
                type="email"
                value={user?.email || ""}
                readOnly
                className="w-full px-3 py-2 rounded-md border opacity-60 cursor-not-allowed"
                style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.noHp ? "#dc2626" : "var(--color-foreground)" }}>Nomor HP</label>
              <input
                type="tel"
                value={noHp}
                onChange={(e) => { setNoHp(e.target.value); setErrors(p => ({ ...p, noHp: false })) }}
                placeholder="08123456789"
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.noHp ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            <div className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
              <p className="text-sm font-semibold mb-3 mt-3" style={{ color: "var(--color-foreground)" }}>Data Guru</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.unitSekolah ? "#dc2626" : "var(--color-foreground)" }}>Unit Sekolah</label>
              <select
                value={unitSekolah}
                onChange={(e) => { setUnitSekolah(e.target.value); setErrors(p => ({ ...p, unitSekolah: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.unitSekolah ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              >
                <option value="">Pilih Unit Sekolah</option>
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.kelas ? "#dc2626" : "var(--color-foreground)" }}>Kelas</label>
              <select
                value={kelas}
                onChange={(e) => { setKelas(e.target.value); setErrors(p => ({ ...p, kelas: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.kelas ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              >
                <option value="">Pilih Kelas</option>
                <option value="7">Kelas 7</option>
                <option value="8">Kelas 8</option>
                <option value="9">Kelas 9</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.mapelId ? "#dc2626" : "var(--color-foreground)" }}>Mata Pelajaran</label>
              <select
                value={mapelId}
                onChange={(e) => { setMapelId(e.target.value); setErrors(p => ({ ...p, mapelId: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.mapelId ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              >
                <option value="">Pilih Mata Pelajaran</option>
                {mataPelajaran.map((m) => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.bank ? "#dc2626" : "var(--color-foreground)" }}>Bank</label>
              <select
                value={bank}
                onChange={(e) => { setBank(e.target.value); setErrors(p => ({ ...p, bank: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.bank ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              >
                <option value="">Pilih Bank</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: errors.noRekening ? "#dc2626" : "var(--color-foreground)" }}>Nomor Rekening</label>
              <input
                type="text"
                value={noRekening}
                onChange={(e) => { setNoRekening(e.target.value); setErrors(p => ({ ...p, noRekening: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.noRekening ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}