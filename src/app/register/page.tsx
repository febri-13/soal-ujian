"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { normalizePhone, isValidPhone } from "@/lib/phone"

interface MataPelajaran {
  id: string
  nama: string
  kode: string | null
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

export default function RegisterPage() {
  const router = useRouter()
  const [nama, setNama] = useState("")
  const [email, setEmail] = useState("")
  const [noHp, setNoHp] = useState("")
  const [role, setRole] = useState<"guru" | "validator">("guru")

  // Data guru (hanya kalau role = guru)
  const [unitSekolah, setUnitSekolah] = useState("")
  const [mapelId, setMapelId] = useState("")
  const [bank, setBank] = useState("")
  const [noRekening, setNoRekening] = useState("")

  const [mataPelajaran, setMataPelajaran] = useState<MataPelajaran[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadMapel() {
      const { data } = await supabase
        .from("mata_pelajaran")
        .select("id, nama, kode")
        .order("nama")
      if (data) setMataPelajaran(data)
    }
    loadMapel()
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const normalized = normalizePhone(noHp)

    if (!isValidPhone(normalized)) {
      setError("Format nomor HP tidak valid. Contoh: 081234567890")
      setLoading(false)
      return
    }

    if (role === "guru") {
      if (!unitSekolah || !mapelId) {
        setError("Unit sekolah dan mata pelajaran wajib diisi untuk guru.")
        setLoading(false)
        return
      }
    }

    // Cek nomor HP unik
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("no_hp", normalized)
      .maybeSingle()

    if (existing) {
      setError("Nomor HP sudah terdaftar. Silakan login.")
      setLoading(false)
      return
    }

    // Daftar ke Supabase Auth — password = no HP ternormalisasi
    // no_hp di metadata = penanda user psat, dibaca trigger psat.create_psat_profile_on_signup
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: normalized,
      options: {
        data: {
          nama,
          no_hp: normalized,
          psat_role: role,
          unit_sekolah: role === "guru" ? unitSekolah : null,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!signUpData.user) {
      setError("Gagal membuat akun. Coba lagi.")
      setLoading(false)
      return
    }

    // Pastikan session aktif sebelum insert (RLS butuh auth.uid())
    if (!signUpData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: normalized,
      })
      if (signInError) {
        setError("Akun dibuat tapi gagal login otomatis: " + signInError.message)
        setLoading(false)
        return
      }
    }

    // psat.profiles sudah diisi otomatis oleh trigger psat.create_psat_profile_on_signup

    // Insert data guru kalau role = guru
    if (role === "guru") {
      const { error: guruError } = await supabase.from("psat_guru_data").insert({
        profile_id: signUpData.user.id,
        mapel_id: mapelId,
        bank: bank || null,
        no_rekening: noRekening || null,
      })

      if (guruError) {
        setError("Gagal simpan data guru: " + guruError.message)
        setLoading(false)
        return
      }
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="w-full max-w-lg p-8 rounded-lg shadow-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: "var(--color-foreground)" }}>Daftar PSAT</h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nama Lengkap</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-3 py-2 rounded-md border"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              autoComplete="name"
              spellCheck={false}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              autoComplete="email"
              spellCheck={false}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nomor HP</label>
            <input
              type="tel"
              value={noHp}
              onChange={(e) => setNoHp(e.target.value)}
              placeholder="08123456789"
              className="w-full px-3 py-2 rounded-md border"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              autoComplete="tel"
              required
            />
            <p className="mt-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              Nomor HP ini juga akan menjadi password Anda untuk login.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "guru" | "validator")}
              className="w-full px-3 py-2 rounded-md border"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              <option value="guru">Guru</option>
              <option value="validator">Validator</option>
            </select>
          </div>

          {role === "guru" && (
            <>
              <div className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                <p className="text-sm font-semibold mb-3 mt-3" style={{ color: "var(--color-foreground)" }}>Data Guru</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Unit Sekolah</label>
                <select
                  value={unitSekolah}
                  onChange={(e) => setUnitSekolah(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  required
                >
                  <option value="">Pilih Unit Sekolah</option>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Mata Pelajaran</label>
                <select
                  value={mapelId}
                  onChange={(e) => setMapelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  required
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {mataPelajaran.map((m) => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Bank (opsional)</label>
                <select
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                >
                  <option value="">Pilih Bank</option>
                  {BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nomor Rekening (opsional)</label>
                <input
                  type="text"
                  value={noRekening}
                  onChange={(e) => setNoRekening(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border"
                  style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {loading ? "Memuat..." : "Daftar"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Sudah punya akun? <a href="/login" style={{ color: "var(--color-primary)" }}>Login</a>
        </p>
      </div>
    </div>
  )
}
