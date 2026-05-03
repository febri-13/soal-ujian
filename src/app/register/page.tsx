"use client"

import { useState } from "react"
  import { supabase } from "@/lib/supabase"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nama, setNama] = useState("")
  const [username, setUsername] = useState("")
  const [role, setRole] = useState("guru")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nama, username } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (signUpData?.user) {
      await supabase.from("profiles").insert({
        id: signUpData.user.id,
        email: email,
        nama: nama,
        username: username,
        role: role,
      })
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
        <div className="w-full max-w-md p-8 rounded-lg shadow-lg border text-center" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
          <h1 className="text-2xl font-bold mb-4" style={{ color: "var(--color-foreground)" }}>Pendaftaran Berhasil!</h1>
          <p className="mb-6" style={{ color: "var(--color-muted-foreground)" }}>Silakan cek email untuk verifikasi.</p>
          <a href="/login" className="py-2 px-4 rounded-md font-medium inline-block" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="w-full max-w-md p-8 rounded-lg shadow-lg border" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: "var(--color-foreground)" }}>Daftar PSAT</h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Nama</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-3 py-2 rounded-md"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-md"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
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
              required minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-foreground)" }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-md"
              style={{ backgroundColor: "var(--color-input)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              <option value="guru">Guru</option>
              <option value="validator">Validator</option>
            </select>
          </div>

          {error && <p style={{ color: "var(--color-destructive)" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md font-medium"
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