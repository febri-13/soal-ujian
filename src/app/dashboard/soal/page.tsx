"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function SoalPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matrix, setMatrix] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push("/login")
        return
      }
      setUser(u)

      const { data: matrixData } = await supabase
        .from("psat_matrix_input")
        .select("*")
        .eq("profile_id", u.id)
        .eq("is_submitted", true)
        .single()

      if (!matrixData) {
        router.push("/dashboard/matrix")
        return
      }

      setMatrix(matrixData)
      setLoading(false)
    }
    load()
  }, [router])

  const handleTambahSoal = (tipe: string, difficulty: string) => {
    router.push(`/dashboard/soal/editor?tipe=${tipe}&difficulty=${difficulty}`)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      <header className="border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>Input Soal</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <p className="mb-4" style={{ color: "var(--color-muted-foreground)" }}>
            Pilih tipe dan tingkat kesulitan untuk input soal:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { tipe: "pilgan", label: "Pilihan Ganda", icon: "🔘" },
              { tipe: "ceklist", label: "Ceklist", icon: "☑️" },
              { tipe: "essay", label: "Essay", icon: "✍️" },
            ].map(({ tipe, label, icon }) => (
              <div key={tipe} className="space-y-3">
                <h3 className="font-medium text-lg" style={{ color: "var(--color-foreground)" }}>
                  {icon} {label}
                </h3>
                {["mudah", "sedang", "sulit"].map(difficulty => (
                  <button
                    key={difficulty}
                    onClick={() => handleTambahSoal(tipe, difficulty)}
                    className="w-full text-left p-3 rounded-lg border"
                    style={{ backgroundColor: "var(--color-accent)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  >
                    <span className="capitalize">{difficulty}</span>
                    <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                      Klik untuk input soal
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}