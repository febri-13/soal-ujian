import { supabase } from "@/lib/supabase"
import { BookOpen, TrendingUp, CheckCircle, Clock, AlertCircle, Download, LayoutGrid, LogIn } from "lucide-react"

export const revalidate = 300

interface MapelProgress {
  mapel_id: string
  mapel_nama: string
  mapel_kode: string | null
  guru_nama: string | null
  total: number
  approved: number
  submitted: number
  draft: number
  needs_revision: number
  glossary_url: string | null
  kisi_kisi_url: string | null
}

export default async function HomePage() {
  const { data, error } = await supabase.rpc("get_public_mapel_progress")
  const rows: MapelProgress[] = (data as MapelProgress[]) ?? []

  const totalSoal      = rows.reduce((s, r) => s + Number(r.total), 0)
  const totalApproved  = rows.reduce((s, r) => s + Number(r.approved), 0)
  const totalSubmitted = rows.reduce((s, r) => s + Number(r.submitted), 0)
  const totalRevision  = rows.reduce((s, r) => s + Number(r.needs_revision), 0)

  return (
    <div style={{ backgroundColor: "var(--color-background)", minHeight: "100vh" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6" style={{ color: "var(--color-primary)" }} />
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--color-foreground)" }}>
                PSAT SMP Al Abidin
              </h1>
              <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                Progress Upload Soal Ujian
              </p>
            </div>
          </div>
          <a
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border"
            style={{
              backgroundColor: "var(--color-primary)",
              borderColor: "var(--color-primary)",
              color: "#ffffff",
              textDecoration: "none",
            }}
          >
            <LogIn className="w-4 h-4" />
            Login
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Total Soal"
            value={totalSoal}
            color="var(--color-foreground)"
            bg="var(--color-card)"
          />
          <SummaryCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Approved"
            value={totalApproved}
            color="#15803d"
            bg="#f0fdf4"
          />
          <SummaryCard
            icon={<Clock className="w-5 h-5" />}
            label="Menunggu Validasi"
            value={totalSubmitted}
            color="#b45309"
            bg="#fef3c7"
          />
          <SummaryCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Perlu Revisi"
            value={totalRevision}
            color="#dc2626"
            bg="#fef2f2"
          />
        </div>

        {/* Progress Table */}
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card)" }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
              Progress Per Mata Pelajaran
            </h2>
          </div>

          {error ? (
            <div className="p-6 text-center text-sm rounded-b-lg" style={{ color: "#dc2626", backgroundColor: "#fef2f2" }}>
              Gagal memuat data. Silakan coba lagi.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>
              Belum ada data tersedia.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-muted)" }}>
                    <th className="px-3 py-2 text-left font-medium w-8" style={{ color: "var(--color-muted-foreground)" }}>No</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-muted-foreground)" }}>Mata Pelajaran</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-muted-foreground)" }}>Guru</th>
                    <th className="px-3 py-2 text-left font-medium min-w-36" style={{ color: "var(--color-muted-foreground)" }}>Progress</th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: "#15803d" }}>Approved</th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: "#b45309" }}>Submitted</th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: "var(--color-muted-foreground)" }}>Draft</th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: "#dc2626" }}>Revisi</th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--color-muted-foreground)" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const total = Number(row.total)
                    const approved = Number(row.approved)
                    const submitted = Number(row.submitted)
                    const draft = Number(row.draft)
                    const needs_revision = Number(row.needs_revision)
                    const pct = total > 0 ? Math.round((approved / total) * 100) : 0
                    const barColor = pct === 100 ? "#22c55e" : pct >= 50 ? "#3b82f6" : "#f59e0b"

                    return (
                      <tr
                        key={row.mapel_id}
                        style={{
                          borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : undefined,
                        }}
                      >
                        <td className="px-3 py-3 text-center" style={{ color: "var(--color-muted-foreground)" }}>
                          {i + 1}
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-medium" style={{ color: "var(--color-foreground)" }}>
                            {row.mapel_nama}
                          </span>
                          {row.mapel_kode && (
                            <span
                              className="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: "var(--color-muted)",
                                color: "var(--color-muted-foreground)",
                              }}
                            >
                              {row.mapel_kode}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3" style={{ color: row.guru_nama ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>
                          {row.guru_nama ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="w-full rounded-full h-2 mb-1" style={{ backgroundColor: "var(--color-muted)" }}>
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: barColor }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                            {approved}/{total} ({pct}%)
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-medium" style={{ color: "#15803d" }}>{approved}</td>
                        <td className="px-3 py-3 text-center font-medium" style={{ color: "#b45309" }}>{submitted}</td>
                        <td className="px-3 py-3 text-center" style={{ color: "var(--color-muted-foreground)" }}>{draft}</td>
                        <td className="px-3 py-3 text-center font-medium" style={{ color: needs_revision > 0 ? "#dc2626" : "var(--color-muted-foreground)" }}>
                          {needs_revision}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ActionButton
                              href={row.glossary_url}
                              icon={<Download className="w-3.5 h-3.5" />}
                              label="Glossary"
                              newTab
                            />
                            <ActionButton
                              href={row.kisi_kisi_url}
                              icon={<Download className="w-3.5 h-3.5" />}
                              label="Kisi-kisi"
                              newTab
                            />
                            <ActionButton
                              href={`/matrix/${row.mapel_id}`}
                              icon={<LayoutGrid className="w-3.5 h-3.5" />}
                              label="Matrix"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-6 text-xs mt-4" style={{ color: "var(--color-muted-foreground)" }}>
        © 2026 PSAT SMP Al Abidin
      </footer>
    </div>
  )
}

function ActionButton({
  href,
  icon,
  label,
  newTab,
}: {
  href: string | null | undefined
  icon: React.ReactNode
  label: string
  newTab?: boolean
}) {
  const className = "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border"
  if (!href) {
    return (
      <span
        className={className}
        style={{
          backgroundColor: "var(--color-muted)",
          borderColor: "var(--color-border)",
          color: "var(--color-muted-foreground)",
          opacity: 0.4,
          cursor: "not-allowed",
          whiteSpace: "nowrap",
        }}
      >
        {icon}
        {label}
      </span>
    )
  }
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className={className}
      style={{
        backgroundColor: "var(--color-muted)",
        borderColor: "var(--color-border)",
        color: "var(--color-foreground)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </a>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: bg, borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ color }}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}
