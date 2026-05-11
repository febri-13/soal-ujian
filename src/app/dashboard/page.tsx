"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check, X,
  User, LayoutGrid, PenSquare, FileText,
  CheckSquare, Settings, Users, Bell,
  AlertTriangle, AlertCircle, CheckCircle, Lightbulb,
  LogOut, Lock, BookOpen,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import ThemeToggle from "@/components/ThemeToggle"

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
  const [hasValidatorProfile, setHasValidatorProfile] = useState(false)
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
      if (!u) { router.push("/login"); return }

      const { data: profileData, error: profileQueryError } = await supabase
        .from("profiles").select("role").eq("id", u.id).maybeSingle()
      if (profileQueryError) console.error("Query profile error:", profileQueryError)

      if (!profileData) {
        const { error: insertError } = await supabase.from("profiles").insert({ id: u.id, email: u.email || "" })
        if (insertError) console.error("Insert profile error:", insertError)
      }

      const { data: fullProfile } = await supabase
        .from("profiles").select("nama, role, no_hp, kelas").eq("id", u.id).maybeSingle()

      setUser({
        id: u.id,
        email: u.email || "",
        nama: u.user_metadata?.nama || fullProfile?.nama || null,
        username: u.user_metadata?.username || null,
        role: fullProfile?.role || "guru",
      })

      const { data: guruData } = await supabase
        .from("psat_guru_data").select("bank, no_rekening, unit_sekolah, mapel_id").eq("profile_id", u.id).maybeSingle()

      const namaOk = !!fullProfile?.nama && fullProfile.nama !== u.id
      setHasProfile(namaOk && !!fullProfile?.no_hp && !!fullProfile?.kelas &&
        !!guruData?.unit_sekolah && !!guruData?.mapel_id && !!guruData?.bank && !!guruData?.no_rekening)

      const vRole = fullProfile?.role || "guru"
      if (vRole === "validator" || vRole === "admin") {
        const { data: vGuruData } = await supabase
          .from("psat_guru_data").select("bank, no_rekening, unit_sekolah").eq("profile_id", u.id).maybeSingle()
        setHasValidatorProfile(namaOk && !!fullProfile?.no_hp && !!vGuruData?.unit_sekolah && !!vGuruData?.bank && !!vGuruData?.no_rekening)
      }

      const { data: matrix } = await supabase
        .from("psat_matrix_input").select("id").eq("profile_id", u.id).eq("is_submitted", true)
      setHasMatrix(!!matrix && matrix.length > 0)

      const [{ count: sub }, { count: app }, { count: rev }] = await Promise.all([
        supabase.from("bank_soal").select("*", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("bank_soal").select("*", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("bank_soal").select("*", { count: "exact", head: true }).eq("status", "needs_revision"),
      ])
      setSubmittedCount(sub || 0)
      setApprovedCount(app || 0)
      setRevisionCount(rev || 0)

      const { data: submittedByMapel } = await supabase
        .from("bank_soal").select("mata_pelajaran_id").eq("status", "submitted")
      const counts: Record<string, number> = {}
      const names: Record<string, string> = {}
      if (submittedByMapel) {
        submittedByMapel.forEach(s => { if (s.mata_pelajaran_id) counts[s.mata_pelajaran_id] = (counts[s.mata_pelajaran_id] || 0) + 1 })
        const { data: mapels } = await supabase.from("mata_pelajaran").select("id, nama")
        mapels?.forEach(m => { names[m.id] = m.nama })
      }
      setMapelCounts(counts)
      setMapelNames(names)

      if (guruData?.mapel_id) {
        const { data: patokanRows } = await supabase
          .from("psat_patokan_soal").select("*").eq("mapel_id", guruData.mapel_id)
          .order("created_at", { ascending: false }).limit(1)
        const pd = patokanRows?.[0]
        if (pd) {
          const p: Record<string, number> = {}
          const tipes = (pd.tipe || "").split(",")
          const tingkatans = (pd.tingkat_kesulitan || "").split(",")
          const keluarArr = (pd.keluar || "").split(",")
          const bankArr = (pd.bank || "").split(",")
          let i = 0
          tipes.forEach((t: string) => tingkatans.forEach((k: string) => {
            p[`${t}_${k}_keluar`] = parseInt(keluarArr[i]) || 0
            p[`${t}_${k}_bank`] = parseInt(bankArr[i]) || 0
            i++
          }))
          setPatokan(p)
        }
      }

      const { data: guruSoal } = await supabase
        .from("bank_soal").select("status, tipe, tingkat_kesulitan").eq("guru_id", u.id)
      if (guruSoal) {
        const stats = { total: guruSoal.length, submitted: 0, approved: 0, needs_revision: 0, draft: 0 }
        const sc: Record<string, number> = {}
        guruSoal.forEach(s => {
          if (s.status === "submitted") stats.submitted++
          else if (s.status === "approved") stats.approved++
          else if (s.status === "needs_revision") stats.needs_revision++
          else stats.draft++
          if (s.tipe && s.tingkat_kesulitan) {
            const key = `${s.tipe}_${s.tingkat_kesulitan}`
            sc[key] = (sc[key] || 0) + 1
          }
        })
        setGuruSoalStats(stats)
        setSoalCounts(sc)
      }

      const { data: matrixBabs } = await supabase
        .from("psat_matrix_input").select("data").eq("profile_id", u.id).eq("is_submitted", true)
      if (matrixBabs) {
        let total = 0
        matrixBabs.forEach(bab => { if (bab.data) Object.keys(bab.data).forEach(k => { if (k.endsWith("_bank")) total += bab.data[k] || 0 }) })
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

  const goTo = (path: string, blocked?: boolean, requireMatrix?: boolean) => {
    if (blocked) { alert("Lengkapi data diri terlebih dahulu!"); return }
    if (requireMatrix && !hasMatrix) { alert("Selesaikan matrix terlebih dahulu sebelum input soal!"); return }
    router.push(path)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--psat-bg)" }}>
        <p style={{ color: "var(--psat-muted)" }}>Memuat...</p>
      </div>
    )
  }

  const userRole = user?.role || "guru"
  const isAdmin = userRole === "admin"
  const isValidator = userRole === "validator"

   const adminMenuItems = [
     ...(isValidator ? [{
       icon: <User className="w-5 h-5" />,
       label: "Profil",
       desc: hasValidatorProfile ? "Data diri lengkap" : "Lengkapi data diri dulu",
       done: hasValidatorProfile,
       locked: false,
       path: "/dashboard/profile",
       color: "var(--psat-primary-light)",
     }] : []),
     {
       icon: <CheckSquare className="w-5 h-5" />,
       label: "Validasi",
       desc: isAdmin || hasValidatorProfile ? "Review & approve soal" : "Lengkapi profil dulu",
       done: false,
       locked: !isAdmin && !hasValidatorProfile,
       path: "/dashboard/validasi",
       color: "var(--psat-green)",
     },
     ...(isAdmin ? [
       {
         icon: <Settings className="w-5 h-5" />,
         label: "Patokan Soal",
         desc: "Atur target soal per mapel",
         done: false,
         locked: false,
         path: "/dashboard/admin",
         color: "var(--psat-teal)",
       },
       {
         icon: <BookOpen className="w-5 h-5" />,
         label: "Mata Pelajaran",
         desc: "Kelola daftar mata pelajaran",
         done: false,
         locked: false,
         path: "/dashboard/admin/mapel",
         color: "var(--psat-amber)",
       },
       {
         icon: <LayoutGrid className="w-5 h-5" />,
         label: "Matrix Guru",
         desc: "Kelola & hapus matrix guru",
         done: false,
         locked: false,
         path: "/dashboard/admin/matrix",
         color: "var(--psat-cyan)",
       },
       {
         icon: <Users className="w-5 h-5" />,
         label: "Users",
         desc: "Kelola users & roles",
         done: false,
         locked: false,
         path: "/admin/users",
         color: "var(--psat-burgundy)",
       },
     ] : []),
   ]

  const guruSteps = [
    {
      step: 1, icon: <User className="w-5 h-5" />, label: "Profil",
      desc: hasProfile ? "Data diri lengkap" : "Data diri (WA, Bank, Rekening)",
      done: hasProfile, locked: false, path: "/dashboard/profile",
      color: "var(--psat-primary-light)",
    },
    {
      step: 2, icon: <LayoutGrid className="w-5 h-5" />, label: "Matrix",
      desc: hasProfile ? "Pemetaan jumlah soal" : "Lengkapi data diri dulu",
      done: hasMatrix, locked: !hasProfile, path: "/dashboard/matrix",
      color: "var(--psat-amber)",
    },
    {
      step: 3, icon: <PenSquare className="w-5 h-5" />, label: "Soal",
      desc: hasMatrix ? "Input soal ujian" : "Selesaikan matrix dulu",
      done: false, locked: !hasMatrix, path: "/dashboard/soal",
      color: "var(--psat-green)",
    },
    {
      step: 4, icon: <FileText className="w-5 h-5" />, label: "Dokumen",
      desc: "Kisi-kisi & Glossary",
      done: false, locked: false, path: "/dashboard/dokumen",
      color: "var(--psat-teal)",
    },
  ]

  const soalStatCards = [
    { label: "Total",       value: guruSoalStats.total,         color: "var(--psat-primary)",     bg: "var(--psat-primary-tint)",  icon: <FileText className="w-4 h-4" /> },
    { label: "Draft",       value: guruSoalStats.draft,         color: "var(--psat-muted)",       bg: "var(--psat-neutral-tint)",  icon: <PenSquare className="w-4 h-4" /> },
    { label: "Submitted",   value: guruSoalStats.submitted,     color: "var(--psat-yellow-text)", bg: "var(--psat-yellow-tint)",   icon: <Bell className="w-4 h-4" /> },
    { label: "Approved",    value: guruSoalStats.approved,      color: "var(--psat-green-text)",  bg: "var(--psat-green-tint)",    icon: <CheckCircle className="w-4 h-4" /> },
    { label: "Perlu Revisi",value: guruSoalStats.needs_revision,color: "var(--psat-red)",         bg: "var(--psat-red-tint)",      icon: <AlertCircle className="w-4 h-4" /> },
  ]

  return (
    <div style={{ backgroundColor: "var(--psat-bg)", minHeight: "100vh" }}>

      {/* Header */}
      <header style={{ backgroundColor: "var(--psat-primary)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--psat-primary-fg)" }}>PSAT Dashboard</h1>
          <div className="flex items-center gap-2">
            <div className="[&_button]:bg-transparent [&_button]:border-white/30 [&_button]:text-white">
              <ThemeToggle />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">

        {/* Welcome card */}
        <div className="rounded-xl p-6 border mb-6 flex items-start gap-4"
          style={{ backgroundColor: "var(--psat-card)", borderColor: "var(--psat-border)" }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-lg"
            style={{ backgroundColor: "var(--psat-primary)", color: "var(--psat-primary-fg)" }}
          >
            {(user?.nama || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold" style={{ color: "var(--psat-primary)" }}>
              Selamat datang, {user?.nama || user?.username || userRole}!
            </h2>
            <p className="text-sm" style={{ color: "var(--psat-muted)" }}>{user?.email}</p>
            <span
              className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium"
              style={{
                backgroundColor: isAdmin ? "var(--psat-burgundy)" : isValidator ? "var(--psat-teal)" : "var(--psat-cyan)",
                color: "var(--psat-primary-fg)",
              }}
            >
              {userRole}
            </span>

            {!isAdmin && !isValidator && !hasProfile && (
              <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: "var(--psat-red)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Silakan lengkapi data diri terlebih dahulu
              </div>
            )}
            {isValidator && !hasValidatorProfile && (
              <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: "var(--psat-red)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Silakan lengkapi data diri sebelum mulai validasi
              </div>
            )}

            {/* Notifikasi validator/admin */}
            {(isAdmin || isValidator) && submittedCount > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4" style={{ color: "var(--psat-amber)" }} />
                  <p className="font-medium text-sm" style={{ color: "var(--psat-primary)" }}>
                    {submittedCount} soal perlu divalidasi:
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(mapelCounts).map(([mapelId, count]) => (
                    <button
                      key={mapelId}
                      onClick={() => { localStorage.setItem("selectedMapelId", mapelId); router.push("/dashboard/validasi") }}
                      className="p-3 rounded-lg border text-left hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "var(--psat-amber-tint)", borderColor: "var(--psat-amber)" }}
                    >
                      <div className="font-medium text-sm" style={{ color: "var(--psat-primary)" }}>
                        {mapelNames[mapelId] || "Unknown"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--psat-muted)" }}>{count} soal</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifikasi guru: revisi / approved */}
        {!isAdmin && !isValidator && (revisionCount > 0 || approvedCount > 0) && (
          <div className="flex gap-3 flex-wrap mb-6">
            {revisionCount > 0 && (
              <div
                onClick={() => router.push("/dashboard/soal")}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--psat-red-tint)", borderColor: "var(--psat-red)" }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--psat-red)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--psat-red)" }}>
                  {revisionCount} soal perlu revisi
                </span>
              </div>
            )}
            {approvedCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border"
                style={{ backgroundColor: "var(--psat-green-tint)", borderColor: "var(--psat-green)" }}>
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "var(--psat-green)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--psat-green-text)" }}>
                  {approvedCount} soal approved
                </span>
              </div>
            )}
          </div>
        )}

        {/* Menu cards */}
        {(isAdmin || isValidator) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {adminMenuItems.map(({ icon, label, desc, done, locked, path, color }) => (
              <button
                key={label}
                onClick={() => goTo(path, locked)}
                disabled={locked}
                className="rounded-xl p-5 border text-left transition-all hover:shadow-md disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--psat-card)",
                  borderColor: "var(--psat-border)",
                  borderLeftWidth: "4px",
                  borderLeftColor: done ? "var(--psat-green)" : locked ? "var(--psat-border)" : color,
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <div className="mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: done ? "var(--psat-green)" : locked ? "var(--psat-muted)" : color,
                      color: "var(--psat-primary-fg)",
                    }}>
                    {done ? <Check className="w-5 h-5" /> : locked ? <Lock className="w-5 h-5" /> : icon}
                  </div>
                </div>
                <h3 className="font-semibold text-sm mb-0.5"
                  style={{ color: locked ? "var(--psat-muted)" : "var(--psat-primary)" }}>
                  {label}
                </h3>
                <p className="text-xs leading-snug" style={{ color: "var(--psat-muted)" }}>{desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Step cards guru */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {guruSteps.map(({ step, icon, label, desc, done, locked, path, color }) => (
                <button
                  key={label}
                  onClick={() => goTo(path, locked, label === "Soal")}
                  disabled={locked}
                  className="rounded-xl p-5 border text-left transition-all hover:shadow-md disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: "var(--psat-card)",
                    borderColor: "var(--psat-border)",
                    borderLeftWidth: "4px",
                    borderLeftColor: done ? "var(--psat-green)" : locked ? "var(--psat-border)" : color,
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: done ? "var(--psat-green)" : locked ? "var(--psat-muted)" : color,
                        color: "var(--psat-primary-fg)",
                      }}>
                      {done ? <Check className="w-5 h-5" /> : locked ? <Lock className="w-5 h-5" /> : icon}
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "var(--psat-bg)", color: "var(--psat-muted)" }}>
                      {step}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-0.5"
                    style={{ color: locked ? "var(--psat-muted)" : "var(--psat-primary)" }}>
                    {label}
                  </h3>
                  <p className="text-xs leading-snug" style={{ color: "var(--psat-muted)" }}>{desc}</p>
                </button>
              ))}
            </div>

            {/* Tips */}
            {!hasMatrix && (
              <div className="mt-4 flex items-start gap-2 p-4 rounded-lg border"
                style={{ backgroundColor: "var(--psat-amber-tint)", borderColor: "var(--psat-amber)" }}>
                <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--psat-amber)" }} />
                <p className="text-sm" style={{ color: "var(--psat-amber-text)" }}>
                  Isi matrix terlebih dahulu untuk dapat input soal. Tetapi Anda bisa upload dokumen sekarang.
                </p>
              </div>
            )}

            {/* Statistik Soal */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold tracking-widest mb-3" style={{ color: "var(--psat-muted)" }}>
                STATISTIK SOAL SAYA
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {soalStatCards.map(({ label, value, color, bg, icon }) => (
                  <div key={label} className="rounded-xl p-4 border text-center"
                    style={{ backgroundColor: bg, borderColor: "var(--psat-border)" }}>
                    <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
                    <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--psat-muted)" }}>{label}</div>
                  </div>
                ))}
              </div>

              {targetBank > 0 && (
                <div className="mt-3 p-4 rounded-lg border"
                  style={{ backgroundColor: "var(--psat-card)", borderColor: "var(--psat-border)" }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: "var(--psat-primary)" }}>Progress Bank Soal</span>
                    <span style={{ color: "var(--psat-muted)" }}>{guruSoalStats.total} / {targetBank}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: "var(--psat-border)" }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((guruSoalStats.total / targetBank) * 100))}%`,
                        backgroundColor: guruSoalStats.total >= targetBank ? "var(--psat-green)" : "var(--psat-primary-light)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--psat-muted)" }}>
                    {guruSoalStats.total >= targetBank
                      ? "Target bank soal tercapai"
                      : `${targetBank - guruSoalStats.total} soal lagi untuk memenuhi target`}
                  </p>
                </div>
              )}

              {/* Progress vs Patokan */}
              {Object.keys(patokan).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold tracking-widest mb-3" style={{ color: "var(--psat-muted)" }}>
                    PROGRESS VS PATOKAN
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {TIPE_OPTIONS.map(tipe => (
                      <div key={tipe} className="rounded-lg p-3 border"
                        style={{ backgroundColor: "var(--psat-card)", borderColor: "var(--psat-border)" }}>
                        <div className="text-sm font-semibold capitalize mb-2" style={{ color: "var(--psat-primary)" }}>{tipe}</div>
                        <div className="flex gap-1 mb-1">
                          <span className="text-xs flex-1" />
                          <span className="text-xs w-16 text-center" style={{ color: "var(--psat-muted)" }}>soal keluar</span>
                          <span className="text-xs w-16 text-center" style={{ color: "var(--psat-muted)" }}>bank soal</span>
                        </div>
                        {KESULITAN_OPTIONS.map(kesulitan => {
                          const dibuat = soalCounts[`${tipe}_${kesulitan}`] || 0
                          const targetKeluar = patokan[`${tipe}_${kesulitan}_keluar`] || 0
                          const targetBankVal = patokan[`${tipe}_${kesulitan}_bank`] || 0
                          const okKeluar = targetKeluar > 0 && dibuat >= targetKeluar
                          const okBank = targetBankVal > 0 && dibuat >= targetBankVal
                          return (
                            <div key={kesulitan} className="flex items-center gap-1 mb-1">
                              <span className="text-xs flex-1 capitalize" style={{ color: "var(--psat-muted)" }}>{kesulitan}</span>
                              <span className="w-16 px-1 py-0.5 rounded text-xs text-center font-medium flex items-center justify-center gap-0.5"
                                style={{
                                  backgroundColor: targetKeluar === 0 ? "var(--psat-bg)" : okKeluar ? "var(--psat-green-tint)" : "var(--psat-red-tint)",
                                  color: targetKeluar === 0 ? "var(--psat-muted)" : okKeluar ? "var(--psat-green-text)" : "var(--psat-red)",
                                }}>
                                {targetKeluar > 0 && (okKeluar ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />)}
                                {dibuat}/{targetKeluar}
                              </span>
                              <span className="w-16 px-1 py-0.5 rounded text-xs text-center font-medium flex items-center justify-center gap-0.5"
                                style={{
                                  backgroundColor: targetBankVal === 0 ? "var(--psat-bg)" : okBank ? "var(--psat-green-tint)" : "var(--psat-red-tint)",
                                  color: targetBankVal === 0 ? "var(--psat-muted)" : okBank ? "var(--psat-green-text)" : "var(--psat-red)",
                                }}>
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
