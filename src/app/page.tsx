import { supabase } from "@/lib/supabase"
import {
  BookOpen, TrendingUp, CheckCircle, Clock, AlertCircle,
  Download, LayoutGrid, LogIn, FileEdit,
} from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"

export const revalidate = 300

interface GuruProgress {
  profile_id: string
  guru_nama: string | null
  guru_kelas: string | null
  mapel_id: string
  mapel_nama: string
  mapel_kode: string | null
  total: number
  approved: number
  submitted: number
  draft: number
  needs_revision: number
  patokan_bank_total: number
  glossary_url: string | null
  kisi_kisi_url: string | null
}

export default async function HomePage() {
  const { data, error } = await supabase.rpc("get_public_guru_progress")
  const rows: GuruProgress[] = (data as GuruProgress[]) ?? []

  const totalSoal      = rows.reduce((s, r) => s + Number(r.total), 0)
  const totalDraft     = rows.reduce((s, r) => s + Number(r.draft), 0)
  const totalApproved  = rows.reduce((s, r) => s + Number(r.approved), 0)
  const totalSubmitted = rows.reduce((s, r) => s + Number(r.submitted), 0)
  const totalRevision  = rows.reduce((s, r) => s + Number(r.needs_revision), 0)

  return (
    <div className="gradient-bg min-h-screen flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b" style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-bold leading-tight truncate" style={{ color: "var(--color-foreground)" }}>
                Portal Validasi Soal PSAT Al Abidin
              </h1>
              <p className="text-xs hidden sm:block" style={{ color: "var(--color-muted-foreground)" }}>
                Progress Upload Soal Ujian
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <a
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--color-primary)", color: "white", textDecoration: "none" }}
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-5">

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Total Soal"
                value={totalSoal}
                gradient="linear-gradient(135deg, #6366f1, #8b5cf6)"
              />
              <StatCard
                icon={<FileEdit className="w-5 h-5" />}
                label="Draft"
                value={totalDraft}
                gradient="linear-gradient(135deg, #64748b, #94a3b8)"
              />
              <StatCard
                icon={<CheckCircle className="w-5 h-5" />}
                label="Approved"
                value={totalApproved}
                gradient="linear-gradient(135deg, #059669, #34d399)"
              />
              <StatCard
                icon={<Clock className="w-5 h-5" />}
                label="Menunggu"
                value={totalSubmitted}
                gradient="linear-gradient(135deg, #d97706, #fbbf24)"
              />
              <StatCard
                icon={<AlertCircle className="w-5 h-5" />}
                label="Perlu Revisi"
                value={totalRevision}
                gradient="linear-gradient(135deg, #dc2626, #f87171)"
              />
            </div>

            {/* Progress table card */}
            <div
              className="rounded-2xl border overflow-hidden card-shadow"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2 className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                  Progress Per Akun Guru
                </h2>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
                >
                  {rows.length} akun
                </span>
              </div>

              {error ? (
                <div className="p-8 text-center text-sm" style={{ color: "#dc2626" }}>
                  Gagal memuat data. Silakan coba lagi.
                </div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                  Belum ada data tersedia.
                </div>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="block md:hidden divide-y" style={{ borderColor: "var(--color-border)" }}>
                    {rows.map((row, i) => {
                      const total        = Number(row.total)
                      const approved     = Number(row.approved)
                      const submitted    = Number(row.submitted)
                      const draft        = Number(row.draft)
                      const needs_revision = Number(row.needs_revision)
                      const patokan      = Number(row.patokan_bank_total)
                      const pct          = patokan > 0 ? Math.min(100, Math.round((total / patokan) * 100)) : 0
                      const barColor     = pct === 100 ? "#22c55e" : pct >= 50 ? "#3b82f6" : "#f59e0b"

                      return (
                        <div key={row.profile_id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{i + 1}.</span>
                                <span className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
                                  {row.mapel_nama}
                                </span>
                                {row.mapel_kode && (
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
                                  >
                                    {row.mapel_kode}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
                                {row.guru_nama ?? "—"}
                              </p>
                            </div>
                            {row.guru_kelas && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                                style={{ backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}
                              >
                                Kls {row.guru_kelas}
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="w-full rounded-full h-1.5 mb-1" style={{ backgroundColor: "var(--color-muted)" }}>
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: barColor }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                              {total}/{patokan} soal ({pct}%)
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-1 text-center">
                            {[
                              { label: "Draft",    value: draft,          color: "var(--color-muted-foreground)" },
                              { label: "Submit",   value: submitted,      color: "#b45309" },
                              { label: "Approved", value: approved,       color: "#15803d" },
                              { label: "Revisi",   value: needs_revision, color: needs_revision > 0 ? "#dc2626" : "var(--color-muted-foreground)" },
                            ].map(({ label, value, color }) => (
                              <div key={label}>
                                <p className="text-xs" style={{ color }}>{label}</p>
                                <p className="text-sm font-semibold" style={{ color }}>{value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ActionButton href={row.glossary_url} icon={<Download className="w-3.5 h-3.5" />} label="Glossary" newTab />
                            <ActionButton href={row.kisi_kisi_url} icon={<Download className="w-3.5 h-3.5" />} label="Kisi-kisi" newTab />
                            <ActionButton href={`/matrix/${row.mapel_id}`} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Matrix" />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-muted)" }}>
                          {[
                            { label: "No",            cls: "w-10 text-center" },
                            { label: "Mata Pelajaran", cls: "" },
                            { label: "Guru",           cls: "" },
                            { label: "Kelas",          cls: "w-16 text-center" },
                            { label: "Progress",       cls: "min-w-40" },
                          ].map(({ label, cls }) => (
                            <th key={label} className={`px-4 py-3 text-left font-medium text-xs uppercase tracking-wide ${cls}`} style={{ color: "var(--color-muted-foreground)" }}>
                              {label}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center font-medium text-xs uppercase tracking-wide" style={{ color: "#15803d" }}>Approved</th>
                          <th className="px-4 py-3 text-center font-medium text-xs uppercase tracking-wide" style={{ color: "#b45309" }}>Submit</th>
                          <th className="px-4 py-3 text-center font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>Draft</th>
                          <th className="px-4 py-3 text-center font-medium text-xs uppercase tracking-wide" style={{ color: "#dc2626" }}>Revisi</th>
                          <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const total          = Number(row.total)
                          const approved       = Number(row.approved)
                          const submitted      = Number(row.submitted)
                          const draft          = Number(row.draft)
                          const needs_revision = Number(row.needs_revision)
                          const patokan        = Number(row.patokan_bank_total)
                          const pct            = patokan > 0 ? Math.min(100, Math.round((total / patokan) * 100)) : 0
                          const barColor       = pct === 100 ? "#22c55e" : pct >= 50 ? "#3b82f6" : "#f59e0b"

                          return (
                            <tr
                              key={row.profile_id}
                              style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : undefined }}
                            >
                              <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                                {i + 1}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium" style={{ color: "var(--color-foreground)" }}>
                                  {row.mapel_nama}
                                </span>
                                {row.mapel_kode && (
                                  <span
                                    className="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
                                  >
                                    {row.mapel_kode}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm" style={{ color: row.guru_nama ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>
                                {row.guru_nama ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {row.guru_kelas ? (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: "var(--color-muted)", color: "var(--color-foreground)" }}
                                  >
                                    {row.guru_kelas}
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--color-muted-foreground)" }}>—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="w-full rounded-full h-1.5 mb-1" style={{ backgroundColor: "var(--color-muted)" }}>
                                  <div
                                    className="h-1.5 rounded-full transition-all"
                                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                                  />
                                </div>
                                <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                                  {total}/{patokan} ({pct}%)
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-sm" style={{ color: "#15803d" }}>{approved}</td>
                              <td className="px-4 py-3 text-center font-semibold text-sm" style={{ color: "#b45309" }}>{submitted}</td>
                              <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>{draft}</td>
                              <td className="px-4 py-3 text-center font-semibold text-sm" style={{ color: needs_revision > 0 ? "#dc2626" : "var(--color-muted-foreground)" }}>
                                {needs_revision}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <ActionButton href={row.glossary_url} icon={<Download className="w-3.5 h-3.5" />} label="Glossary" newTab />
                                  <ActionButton href={row.kisi_kisi_url} icon={<Download className="w-3.5 h-3.5" />} label="Kisi-kisi" newTab />
                                  <ActionButton href={`/matrix/${row.mapel_id}`} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Matrix" />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
      </main>

      <footer className="text-center py-4 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        © 2026 PSAT SMP Al Abidin
      </footer>
    </div>
  )
}

function StatCard({
  icon, label, value, gradient,
}: {
  icon: React.ReactNode
  label: string
  value: number
  gradient: string
}) {
  return (
    <div
      className="rounded-2xl p-4 card-shadow relative overflow-hidden"
      style={{ background: gradient }}
    >
      {/* Dekorasi lingkaran di pojok kanan atas */}
      <div
        className="absolute -right-3 -top-3 w-16 h-16 rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
      />
      <div
        className="absolute -right-1 -top-5 w-10 h-10 rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
      />
      <div className="relative">
        <div className="mb-3 opacity-90" style={{ color: "white" }}>
          {icon}
        </div>
        <p className="text-3xl font-bold text-white leading-none mb-1.5">
          {value}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.75)" }}>
          {label}
        </p>
      </div>
    </div>
  )
}

function ActionButton({
  href, icon, label, newTab,
}: {
  href: string | null | undefined
  icon: React.ReactNode
  label: string
  newTab?: boolean
}) {
  const cls = "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border"
  if (!href) {
    return (
      <span
        className={cls}
        style={{
          backgroundColor: "var(--color-muted)",
          borderColor: "var(--color-border)",
          color: "var(--color-muted-foreground)",
          opacity: 0.4,
          cursor: "not-allowed",
          whiteSpace: "nowrap",
        }}
      >
        {icon}{label}
      </span>
    )
  }
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className={cls}
      style={{
        backgroundColor: "var(--color-muted)",
        borderColor: "var(--color-border)",
        color: "var(--color-foreground)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {icon}{label}
    </a>
  )
}
