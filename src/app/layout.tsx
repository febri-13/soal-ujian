import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PSAT SMP Al Abidin",
  description: "Sistem Penilaian Akhir Tahun",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}