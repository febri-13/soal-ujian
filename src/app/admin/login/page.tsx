"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import ThemeToggle from "@/components/ThemeToggle"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError("Email atau password salah.")
      setLoading(false)
      return
    }

    router.push("/dashboard/admin")
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md p-8 rounded-lg shadow-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--color-foreground)" }}>Login Admin</h1>
        <p className="text-center text-sm mb-6" style={{ color: "var(--color-muted-foreground)" }}>Panel Administrasi PSAT</p>

        <form onSubmit={handleLogin} className="space-y-4">
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
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {loading ? "Memuat..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <a href="/login" style={{ color: "var(--color-muted-foreground)" }}>← Login sebagai Guru / Validator</a>
        </p>
      </div>
    </div>
  )
}
