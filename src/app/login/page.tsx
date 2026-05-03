"use client"

import { useState } from "react"
  import { useRouter } from "next/navigation"
  import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (signInData?.user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", signInData.user.id)
        .single()

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          id: signInData.user.id,
          email: email,
        })
      }
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="w-full max-w-md p-8 rounded-lg shadow-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: "var(--color-foreground)" }}>Login PSAT</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md"
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
              className="w-full px-3 py-2 rounded-md"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p style={{ color: "var(--color-destructive)" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md font-medium"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            {loading ? "Memuat..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Belum punya akun?{" "}
          <a href="/register" style={{ color: "var(--color-primary)" }}>Daftar</a>
        </p>
      </div>
    </div>
  )
}