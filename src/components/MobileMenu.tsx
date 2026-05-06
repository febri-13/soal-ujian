'use client'
import { useState } from 'react'
import { Menu, X, BookOpen, LogIn } from 'lucide-react'

export default function MobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg"
        style={{ color: 'var(--color-foreground)' }}
        aria-label="Buka menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 flex flex-col p-5 shadow-2xl"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-foreground)' }}>PSAT</p>
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>SMP Al Abidin</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1" />

            <a
              href="/login"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border"
              style={{
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                textDecoration: 'none',
              }}
              onClick={() => setOpen(false)}
            >
              <LogIn className="w-4 h-4" />
              Login
            </a>
          </div>
        </div>
      )}
    </>
  )
}
