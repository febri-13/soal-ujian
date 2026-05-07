"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Toast from "@/components/Toast"
import { CircleHelp } from "lucide-react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"

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

const BANK_OPTIONS = ["CIMB", "MayBank"]

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string>("guru")
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

  const isValidator = role === "validator"
  const isAdmin = role === "admin"
  const isGuruRole = !isValidator && !isAdmin

  const startTour = useCallback(() => {
    const guruSteps = [
      {
        element: "#tour-profile-header",
        popover: {
          title: "Profil Saya",
          description: "Halaman ini untuk melengkapi data diri kamu. Data ini wajib diisi sebelum bisa mengisi matrix dan soal.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-nama",
        popover: {
          title: "Nama Lengkap",
          description: "Isi nama lengkap kamu sesuai identitas resmi.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-nohp",
        popover: {
          title: "Nomor HP",
          description: "Nomor WhatsApp aktif yang bisa dihubungi.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-unit",
        popover: {
          title: "Unit Sekolah",
          description: "Pilih unit sekolah tempat kamu mengajar.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-kelas",
        popover: {
          title: "Kelas",
          description: "Pilih kelas yang kamu ampu (7, 8, atau 9).",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-mapel",
        popover: {
          title: "Mata Pelajaran",
          description: "Pilih mata pelajaran yang kamu ajarkan. Ini akan menentukan soal apa yang perlu kamu buat.",
          side: "top" as const,
        },
      },
      {
        element: "#tour-bank",
        popover: {
          title: "Bank & No. Rekening",
          description: "Isi informasi rekening untuk keperluan pembayaran honorarium pembuatan soal.",
          side: "top" as const,
        },
      },
      {
        element: "#tour-simpan",
        popover: {
          title: "Simpan Data",
          description: "Setelah semua terisi, klik Simpan. Kamu akan diarahkan kembali ke dashboard.",
          side: "top" as const,
        },
      },
    ]

    const validatorSteps = [
      {
        element: "#tour-profile-header",
        popover: {
          title: "Profil Saya",
          description: "Lengkapi data diri kamu sebelum bisa mulai memvalidasi soal.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-nama",
        popover: {
          title: "Nama Lengkap",
          description: "Isi nama lengkap kamu. Nama ini akan muncul di catatan validasi soal.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-nohp",
        popover: {
          title: "Nomor HP",
          description: "Nomor WhatsApp aktif yang bisa dihubungi.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-unit",
        popover: {
          title: "Unit Sekolah",
          description: "Pilih unit sekolah tempat kamu bertugas.",
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-bank",
        popover: {
          title: "Bank & No. Rekening",
          description: "Isi informasi rekening untuk keperluan pembayaran honorarium validasi soal.",
          side: "top" as const,
        },
      },
      {
        element: "#tour-simpan",
        popover: {
          title: "Simpan Data",
          description: "Setelah terisi, klik Simpan. Kamu langsung bisa mulai memvalidasi soal.",
          side: "top" as const,
        },
      },
    ]

    const driverObj = driver({
      showProgress: true,
      steps: isValidator ? validatorSteps : guruSteps,
      nextBtnText: "Lanjut →",
      prevBtnText: "← Kembali",
      doneBtnText: "Selesai",
      progressText: "{{current}} dari {{total}}",
    })

    driverObj.drive()
  }, [isValidator])

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const { data: mapelData } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama")
      if (mapelData) setMataPelajaran(mapelData)

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single()

      if (!profileData) {
        await supabase.from("profiles").insert({ id: u.id, email: u.email })
      }

      const userRole = profileData?.role || "guru"
      setRole(userRole)
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

  // Auto-show tour pertama kali
  useEffect(() => {
    if (loading) return
    const key = `profile_tour_done_${role}`
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1")
      setTimeout(() => startTour(), 600)
    }
  }, [loading, role, startTour])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const fieldErrors: Record<string, boolean> = {
      nama: !nama.trim(),
      noHp: !noHp.trim(),
      unitSekolah: !unitSekolah,
    }

    // Bank & rekening wajib untuk semua (guru + validator)
    fieldErrors.bank = !bank
    fieldErrors.noRekening = !noRekening.trim()
    // Kelas & mapel hanya untuk guru
    if (isGuruRole) {
      fieldErrors.kelas = !kelas
      fieldErrors.mapelId = !mapelId
    }

    setErrors(fieldErrors)

    if (Object.values(fieldErrors).some(Boolean)) {
      setToast({ message: "Lengkapi semua field yang ditandai merah.", type: "error" })
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ nama, no_hp: noHp, kelas: isGuruRole ? kelas : null })
      .eq("id", user.id)

    if (profileError) {
      setToast({ message: "Gagal simpan profil: " + profileError.message, type: "error" })
      setSaving(false)
      return
    }

    // Simpan ke psat_guru_data untuk semua role
    const { data: existing } = await supabase
      .from("psat_guru_data")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle()

    const guruPayload = {
      whatsapp: noHp,
      no_rekening: noRekening,
      bank,
      unit_sekolah: unitSekolah,
      mapel_id: isGuruRole ? (mapelId || null) : null,
    }

    let guruError
    if (existing) {
      const { error } = await supabase
        .from("psat_guru_data")
        .update({ ...guruPayload, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      guruError = error
    } else {
      const { error } = await supabase
        .from("psat_guru_data")
        .insert({ profile_id: user.id, ...guruPayload })
      guruError = error
    }

    if (guruError) {
      setToast({ message: "Gagal simpan data: " + guruError.message, type: "error" })
      setSaving(false)
      return
    }

    setSaving(false)
    setToast({ message: "Data berhasil disimpan!", type: "success" })
    setTimeout(() => router.push("/dashboard"), 1500)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--color-muted-foreground)" }}>Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <div id="tour-profile-header" className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} style={{ color: "var(--color-muted-foreground)" }}>
              ← Kembali
            </button>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Profil Saya</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
              {role}
            </span>
          </div>
          <button
            onClick={startTour}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)", backgroundColor: "var(--color-card)" }}
            title="Panduan pengisian profil"
          >
            <CircleHelp className="w-4 h-4" />
            <span className="hidden sm:inline">Panduan</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <p className="mb-6 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            {isValidator
              ? "Lengkapi data diri agar nama kamu muncul dengan benar di catatan validasi soal."
              : "Lengkapi data diri sebelum mengisi matrix dan soal."}
          </p>

          <form onSubmit={handleSave} className="space-y-4">

            {/* Nama */}
            <div id="tour-nama">
              <label className="block text-sm font-medium mb-1" style={{ color: errors.nama ? "#dc2626" : "var(--color-foreground)" }}>
                Nama Lengkap
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => { setNama(e.target.value); setErrors(p => ({ ...p, nama: false })) }}
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.nama ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            {/* Email (readonly) */}
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

            {/* No HP */}
            <div id="tour-nohp">
              <label className="block text-sm font-medium mb-1" style={{ color: errors.noHp ? "#dc2626" : "var(--color-foreground)" }}>
                Nomor HP
              </label>
              <input
                type="tel"
                value={noHp}
                onChange={(e) => { setNoHp(e.target.value); setErrors(p => ({ ...p, noHp: false })) }}
                placeholder="08123456789"
                className="w-full px-3 py-2 rounded-md border"
                style={{ backgroundColor: "var(--color-input)", borderColor: errors.noHp ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
              />
            </div>

            {/* Unit Sekolah */}
            <div id="tour-unit">
              <label className="block text-sm font-medium mb-1" style={{ color: errors.unitSekolah ? "#dc2626" : "var(--color-foreground)" }}>
                Unit Sekolah
              </label>
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

            {/* Field khusus guru: Kelas & Mata Pelajaran */}
            {isGuruRole && (
              <>
                <div className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <p className="text-sm font-semibold mb-3 mt-3" style={{ color: "var(--color-foreground)" }}>Data Guru</p>
                </div>

                <div id="tour-kelas">
                  <label className="block text-sm font-medium mb-1" style={{ color: errors.kelas ? "#dc2626" : "var(--color-foreground)" }}>
                    Kelas
                  </label>
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

                <div id="tour-mapel">
                  <label className="block text-sm font-medium mb-1" style={{ color: errors.mapelId ? "#dc2626" : "var(--color-foreground)" }}>
                    Mata Pelajaran
                  </label>
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
              </>
            )}

            {/* Bank & Rekening — semua role */}
            <div id="tour-bank" className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
              <p className="text-sm font-semibold mb-3 mt-3" style={{ color: "var(--color-foreground)" }}>Data Rekening</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: errors.bank ? "#dc2626" : "var(--color-foreground)" }}>
                    Bank
                  </label>
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
                  <label className="block text-sm font-medium mb-1" style={{ color: errors.noRekening ? "#dc2626" : "var(--color-foreground)" }}>
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    value={noRekening}
                    onChange={(e) => { setNoRekening(e.target.value); setErrors(p => ({ ...p, noRekening: false })) }}
                    className="w-full px-3 py-2 rounded-md border"
                    style={{ backgroundColor: "var(--color-input)", borderColor: errors.noRekening ? "#dc2626" : "var(--color-border)", color: "var(--color-foreground)" }}
                  />
                </div>
              </div>
            </div>

            {/* Tombol aksi */}
            <div id="tour-simpan" className="flex gap-3 pt-4">
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
                onClick={() => router.push("/dashboard")}
                className="py-2 px-4 rounded-md font-medium border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                Nanti Saja
              </button>
            </div>
          </form>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
