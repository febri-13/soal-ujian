"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

const TIPE_OPTIONS = ["pilgan", "ceklist", "essay"]
const KESULITAN_OPTIONS = ["mudah", "sedang", "sulit"]

interface User {
  id: string
  email: string
  nama: string | null
  username: string | null
  role: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [hasMatrix, setHasMatrix] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [approvedCount, setApprovedCount] = useState(0)
  const [revisionCount, setRevisionCount] = useState(0)
  const [mapelCounts, setMapelCounts] = useState<Record<string, number>>({})
  const [mapelNames, setMapelNames] = useState<Record<string, string>>({})
  const [guruSoalStats, setGuruSoalStats] = useState({ total: 0, submitted: 0, approved: 0, needs_revision: 0, draft: 0 })
  const [soalCounts, setSoalCounts] = useState<Record<string, number>>({})
  const [patokan, setPatokan] = useState<Record<string, number>>({})
  const [targetBank, setTargetBank] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }

      const { data: profileData, error: profileQueryError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .maybeSingle()

      if (profileQueryError) {
        console.error("Query profile error:", profileQueryError)
      }

      if (!profileData) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: u.id,
          email: u.email || "",
        })
        if (insertError) {
          console.error("Insert profile error:", insertError)
        }
      }

      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("nama, role")
        .eq("id", u.id)
        .maybeSingle()

      setUser({
        id: u.id,
        email: u.email || "",
        nama: u.user_metadata?.nama || fullProfile?.nama || null,
        username: u.user_metadata?.username || null,
        role: fullProfile?.role || "guru",
      })

      const { data: profile } = await supabase
        .from("psat_guru_data")
        .select("id")
        .eq("profile_id", u.id)
      setHasProfile(!!profile && profile.length > 0)

      const { data: matrix } = await supabase
        .from("psat_matrix_input")
        .select("id")
        .eq("profile_id", u.id)
        .eq("is_submitted", true)
      setHasMatrix(!!matrix && matrix.length > 0)

      const { count: submittedSoal } = await supabase
        .from("bank_soal")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted")
      setSubmittedCount(submittedSoal || 0)

      const { count: approvedSoal } = await supabase
        .from("bank_soal")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved")
      setApprovedCount(approvedSoal || 0)

      const { count: revisionSoal } = await supabase
        .from("bank_soal")
        .select("*", { count: "exact", head: true })
        .eq("status", "needs_revision")
      setRevisionCount(revisionSoal || 0)

      const { data: submittedByMapel } = await supabase
        .from("bank_soal")
        .select("mata_pelajaran_id")
        .eq("status", "submitted")
      
      const counts: Record<string, number> = {}
      const names: Record<string, string> = {}
      if (submittedByMapel) {
        submittedByMapel.forEach(s => {
          if (s.mata_pelajaran_id) {
            counts[s.mata_pelajaran_id] = (counts[s.mata_pelajaran_id] || 0) + 1
          }
        })
        
        const { data: mapels } = await supabase
          .from("mata_pelajaran")
          .select("id, nama")
        
        if (mapels) {
          mapels.forEach(m => {
            names[m.id] = m.nama
          })
        }
      }
      setMapelCounts(counts)
      setMapelNames(names)

      // Load mapel guru & patokan
      const { data: guruData } = await supabase
        .from("psat_guru_data")
        .select("mapel_id")
        .eq("profile_id", u.id)
        .maybeSingle()

      if (guruData?.mapel_id) {
        const { data: patokanRows } = await supabase
          .from("psat_patokan_soal")
          .select("*")
          .eq("mapel_id", guruData.mapel_id)
          .order("created_at", { ascending: false })
          .limit(1)

        const patokanData = patokanRows?.[0] || null
        if (patokanData) {
          const p: Record<string, number> = {}
          const tipes = (patokanData.tipe || "").split(",")
          const tingkatans = (patokanData.tingkat_kesulitan || "").split(",")
          const keluarArr = (patokanData.keluar || "").split(",")
          const bankArr = (patokanData.bank || "").split(",")
          let i = 0
          tipes.forEach((tipe: string) => {
            tingkatans.forEach((kesulitan: string) => {
              p[`${tipe}_${kesulitan}_keluar`] = parseInt(keluarArr[i]) || 0
              p[`${tipe}_${kesulitan}_bank`] = parseInt(bankArr[i]) || 0
              i++
            })
          })
          setPatokan(p)
        }
      }

      // Statistik soal milik guru ini
      const { data: guruSoal } = await supabase
        .from("bank_soal")
        .select("status, tipe, tingkat_kesulitan")
        .eq("guru_id", u.id)

      if (guruSoal) {
        const stats = { total: guruSoal.length, submitted: 0, approved: 0, needs_revision: 0, draft: 0 }
        const counts: Record<string, number> = {}
        guruSoal.forEach(s => {
          if (s.status === "submitted") stats.submitted++
          else if (s.status === "approved") stats.approved++
          else if (s.status === "needs_revision") stats.needs_revision++
          else stats.draft++
          if (s.tipe && s.tingkat_kesulitan) {
            const key = `${s.tipe}_${s.tingkat_kesulitan}`
            counts[key] = (counts[key] || 0) + 1
          }
        })
        setGuruSoalStats(stats)
        setSoalCounts(counts)
      }

      // Target bank soal dari matrix
      const { data: matrixBabs } = await supabase
        .from("psat_matrix_input")
        .select("data")
        .eq("profile_id", u.id)
        .eq("is_submitted", true)

      if (matrixBabs) {
        let total = 0
        matrixBabs.forEach(bab => {
          if (bab.data) {
            Object.keys(bab.data).forEach(key => {
              if (key.endsWith("_bank")) total += bab.data[key] || 0
            })
          }
        })
        setTargetBank(total)
      }

      setLoading(false)
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const goTo = (path: string, requireProfile?: boolean, requireMatrix?: boolean) => {
    if (requireProfile && !hasProfile) {
      alert("Lengkapi data diri terlebih dahulu sebelum mengisi matrix!")
      return
    }
    if (requireMatrix && !hasMatrix) {
      alert("Selesaikan matrix terlebih dahulu sebelum input soal!")
      return
    }
    router.push(path)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <p style={{ color: "var(--color-muted-foreground)" }}>Memuat...</p>
      </div>
    )
  }

  const userRole = user?.role || "guru"
  const isAdmin = userRole === "admin"
  const isValidator = userRole === "validator"

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>PSAT Dashboard</h1>
          <button onClick={handleLogout} className="text-sm underline" style={{ color: "var(--color-destructive)" }}>
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border mb-6" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--color-foreground)" }}>
            Selamat datang, {user?.nama || user?.username || userRole}!
          </h2>
          <p className="mb-2" style={{ color: "var(--color-muted-foreground)" }}>{user?.email}</p>
          <div className="flex gap-2">
            <span className={`px-2 py-1 text-xs rounded ${
              isAdmin ? "bg-purple-600 text-white" :
              isValidator ? "bg-blue-600 text-white" :
              "bg-gray-500 text-white"
            }`}>
              {userRole}
            </span>
          </div>
          {!isAdmin && !isValidator && !hasProfile && (
            <p className="text-sm mt-2" style={{ color: "var(--color-destructive)" }}>
              ⚠️ Silakan lengkapi data diri terlebih dahulu
            </p>
          )}

{(isAdmin || isValidator) && submittedCount > 0 && (
          <div className="mt-4">
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              🔔 {submittedCount} soal perlu divalidasi:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(mapelCounts).map(([mapelId, count]) => (
                <button
                  key={mapelId}
                  onClick={() => {
                    localStorage.setItem("selectedMapelId", mapelId)
                    router.push("/dashboard/validasi")
                  }}
                  className="p-3 rounded-lg border text-left cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: "#fef3c7", borderColor: "#f59e0b" }}
                >
                  <div className="font-medium" style={{ color: "#92400e" }}>
                    {mapelNames[mapelId] || "Unknown"}
                  </div>
                  <div className="text-sm" style={{ color: "#b45309" }}>
                    {count} soal
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isAdmin && !isValidator && (revisionCount > 0 || approvedCount > 0) && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {revisionCount > 0 && (
              <div 
                onClick={() => router.push("/dashboard/soal")}
                className="p-4 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#fef2f2", borderColor: "#ef4444" }}
              >
                <p style={{ color: "#dc2626" }}>
                  🔴 {revisionCount} soal perlu revision
                </p>
              </div>
            )}
            {approvedCount > 0 && (
              <div className="p-4 rounded-lg border" style={{ backgroundColor: "#f0fdf4", borderColor: "#22c55e" }}>
                <p className="text-green-700">
                  🟢 {approvedCount} soal approved
                </p>
              </div>
            )}
          </div>
        )}
          </div>

        {(isAdmin || isValidator) ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => goTo("/dashboard/validasi")}
              className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
              style={{ 
                borderColor: "var(--color-border)", 
                backgroundColor: "var(--color-card)" 
              }}
            >
              <div className="text-2xl mb-2">✅</div>
              <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Validasi</h3>
              <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                Review & approve soal
              </p>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => goTo("/dashboard/admin")}
                  className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
                >
                  <div className="text-2xl mb-2">⚙️</div>
                  <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Patokan Soal</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                    Atur target soal per mapel
                  </p>
                </button>

                <button
                  onClick={() => goTo("/dashboard/admin/matrix")}
                  className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
                >
                  <div className="text-2xl mb-2">📊</div>
                  <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Matrix Guru</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                    Kelola & hapus matrix guru
                  </p>
                </button>

                <button
                  onClick={() => goTo("/admin/users")}
                  className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
                >
                  <div className="text-2xl mb-2">👥</div>
                  <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Users</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                    Kelola users & roles
                  </p>
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                onClick={() => goTo("/dashboard/profile")}
                className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                style={{ 
                  borderColor: hasProfile ? "#22c55e" : "var(--color-border)", 
                  backgroundColor: "var(--color-card)" 
                }}
              >
                <div className="text-2xl mb-2">👤</div>
                <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>
                  Profil {hasProfile && "✓"}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  {hasProfile ? "Data diri lengkap" : "Data diri (WA, Bank, Rekening)"}
                </p>
              </button>

              <button
                onClick={() => goTo("/dashboard/matrix", true)}
                className="rounded-lg p-4 border text-left transition-opacity"
                style={{
                  borderColor: hasMatrix ? "#22c55e" : "var(--color-border)",
                  backgroundColor: "var(--color-card)",
                  opacity: hasProfile ? 1 : 0.5,
                  cursor: hasProfile ? "pointer" : "not-allowed",
                }}
              >
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-medium" style={{ color: hasProfile ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>
                  Matrix {hasMatrix && "✓"}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  {hasProfile ? "Pemetaan jumlah soal" : "Lengkapi data diri dulu"}
                </p>
              </button>

              <button
                onClick={() => goTo("/dashboard/soal", false, true)}
                className="rounded-lg p-4 border text-left transition-opacity"
                style={{
                  borderColor: hasMatrix ? "var(--color-border)" : "var(--color-muted)",
                  backgroundColor: "var(--color-card)",
                  opacity: hasMatrix ? 1 : 0.5,
                  cursor: hasMatrix ? "pointer" : "not-allowed",
                }}
              >
                <div className="text-2xl mb-2">📝</div>
                <h3 className="font-medium" style={{ color: hasMatrix ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>Soal</h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  {hasMatrix ? "Input soal ujian" : "Selesaikan matrix dulu"}
                </p>
              </button>

              <button
                onClick={() => goTo("/dashboard/dokumen")}
                className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                style={{ 
                  borderColor: "var(--color-border)", 
                  backgroundColor: "var(--color-card)" 
                }}
              >
                <div className="text-2xl mb-2">📄</div>
                <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Dokumen</h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Kisi-kisi & Glossary
                </p>
              </button>
            </div>

            {!hasMatrix && (
              <div className="mt-6 p-4 rounded-lg border" style={{ backgroundColor: "#fef3c7", borderColor: "#f59e0b" }}>
                <p style={{ color: "#92400e" }}>
                  💡 Tips: Isi matrix terlebih dahulu untuk dapat input soal.
                  Tetapi Anda bisa upload dokumen sekarang.
                </p>
              </div>
            )}

            {/* Statistik Soal */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-muted-foreground)" }}>STATISTIK SOAL SAYA</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total", value: guruSoalStats.total, color: "var(--color-foreground)", bg: "var(--color-card)" },
                  { label: "Draft", value: guruSoalStats.draft, color: "#6b7280", bg: "#f9fafb" },
                  { label: "Submitted", value: guruSoalStats.submitted, color: "#b45309", bg: "#fef3c7" },
                  { label: "Approved", value: guruSoalStats.approved, color: "#15803d", bg: "#f0fdf4" },
                  { label: "Perlu Revisi", value: guruSoalStats.needs_revision, color: "#dc2626", bg: "#fef2f2" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="rounded-lg p-4 border text-center" style={{ backgroundColor: bg, borderColor: "var(--color-border)" }}>
                    <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>{label}</div>
                  </div>
                ))}
              </div>

              {targetBank > 0 && (
                <div className="mt-3 p-4 rounded-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: "var(--color-foreground)" }}>Progress Bank Soal</span>
                    <span style={{ color: "var(--color-muted-foreground)" }}>{guruSoalStats.total} / {targetBank}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: "var(--color-muted)" }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((guruSoalStats.total / targetBank) * 100))}%`,
                        backgroundColor: guruSoalStats.total >= targetBank ? "#22c55e" : "#3b82f6",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                    {guruSoalStats.total >= targetBank
                      ? "Target bank soal tercapai"
                      : `${targetBank - guruSoalStats.total} soal lagi untuk memenuhi target`}
                  </p>
                </div>
              )}

              {/* Progress per tipe × kesulitan vs patokan */}
              {Object.keys(patokan).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--color-muted-foreground)" }}>PROGRESS VS PATOKAN</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {TIPE_OPTIONS.map(tipe => (
                      <div key={tipe} className="rounded-lg p-3 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
                        <div className="text-sm font-semibold capitalize mb-2" style={{ color: "var(--color-foreground)" }}>{tipe}</div>
                        <div className="flex gap-1 mb-1">
                          <span className="text-xs flex-1" />
                          <span className="text-xs w-16 text-center" style={{ color: "var(--color-muted-foreground)" }}>soal keluar</span>
                          <span className="text-xs w-16 text-center" style={{ color: "var(--color-muted-foreground)" }}>bank soal</span>
                        </div>
                        {KESULITAN_OPTIONS.map(kesulitan => {
                          const dibuat = soalCounts[`${tipe}_${kesulitan}`] || 0
                          const targetKeluar = patokan[`${tipe}_${kesulitan}_keluar`] || 0
                          const targetBankVal = patokan[`${tipe}_${kesulitan}_bank`] || 0
                          const okKeluar = targetKeluar > 0 && dibuat >= targetKeluar
                          const okBank = targetBankVal > 0 && dibuat >= targetBankVal
                          return (
                            <div key={kesulitan} className="flex items-center gap-1 mb-1">
                              <span className="text-xs flex-1 capitalize" style={{ color: "var(--color-muted-foreground)" }}>{kesulitan}</span>
                              <span className="w-16 px-1 py-0.5 rounded text-xs text-center font-medium flex items-center justify-center gap-0.5"
                                style={{ backgroundColor: targetKeluar === 0 ? "var(--color-muted)" : okKeluar ? "#f0fdf4" : "#fef2f2", color: targetKeluar === 0 ? "var(--color-muted-foreground)" : okKeluar ? "#15803d" : "#dc2626" }}>
                                {targetKeluar > 0 && (okKeluar ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />)}
                                {dibuat}/{targetKeluar}
                              </span>
                              <span className="w-16 px-1 py-0.5 rounded text-xs text-center font-medium flex items-center justify-center gap-0.5"
                                style={{ backgroundColor: targetBankVal === 0 ? "var(--color-muted)" : okBank ? "#f0fdf4" : "#fef2f2", color: targetBankVal === 0 ? "var(--color-muted-foreground)" : okBank ? "#15803d" : "#dc2626" }}>
                                {targetBankVal > 0 && (okBank ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />)}
                                {dibuat}/{targetBankVal}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}