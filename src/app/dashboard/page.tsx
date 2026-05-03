"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

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

      setLoading(false)
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const goTo = (path: string, requireMatrix?: boolean) => {
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
          <div 
            onClick={() => router.push("/dashboard/validasi")}
            className="mt-4 p-4 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#fef3c7", borderColor: "#f59e0b" }}
          >
            <p style={{ color: "#92400e" }}>
              🔔 Ada {submittedCount} soal yang perlu divalidasi. Klik untuk review.
            </p>
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
              <button
                onClick={() => goTo("/admin/users")}
                className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                style={{ 
                  borderColor: "var(--color-border)", 
                  backgroundColor: "var(--color-card)" 
                }}
              >
                <div className="text-2xl mb-2">👥</div>
                <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Users</h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Kelola users & roles
                </p>
              </button>
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
                onClick={() => goTo("/dashboard/matrix")}
                className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                style={{ 
                  borderColor: hasMatrix ? "#22c55e" : "var(--color-border)", 
                  backgroundColor: "var(--color-card)" 
                }}
              >
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>
                  Matrix {hasMatrix && "✓"}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Pemetaan jumlah soal
                </p>
              </button>

              <button
                onClick={() => goTo("/dashboard/soal", true)}
                className="rounded-lg p-4 border text-left hover:opacity-80 transition-opacity"
                style={{ 
                  borderColor: "var(--color-border)", 
                  backgroundColor: "var(--color-card)",
                  opacity: 1
                }}
              >
                <div className="text-2xl mb-2">📝</div>
                <h3 className="font-medium" style={{ color: "var(--color-foreground)" }}>Soal</h3>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Input soal ujian
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
          </>
        )}
      </main>
    </div>
  )
}