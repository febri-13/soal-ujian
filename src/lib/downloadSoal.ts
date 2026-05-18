export interface SoalDownload {
  id: string
  pertanyaan: string
  tipe: string
  tingkat_kesulitan: string
  bobot: number
  bab_id_text: string
  pilihan: Array<{ id: number; teks: string; benar: boolean }> | null
  pilihan_gambar?: string[]
  status: string
  revision_notes?: string | null
}

export interface SoalProcessed {
  id: string
  tipe: string
  tingkat_kesulitan: string
  bobot: number
  bab_id_text: string
  status: string
  pertanyaan_text: string
  pertanyaan_images: string[]
  pilihan: Array<{
    id: number
    teks_plain: string
    benar: boolean
    gambar_url: string | null
  }> | null
}

export interface PdfMeta {
  judul: string
  tanggal: string
}

export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('.math-frac').forEach(el => {
    const num = el.querySelector('.math-num')?.textContent ?? ''
    const den = el.querySelector('.math-den')?.textContent ?? ''
    el.replaceWith(`[${num}/${den}]`)
  })
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function extractImages(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('img'))
    .map(img => img.getAttribute('src') ?? '')
    .filter(src => /^https?:\/\//.test(src))
}

export async function convertImageToJpegDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return null
  }
}

export function processSoal(raw: SoalDownload[]): SoalProcessed[] {
  return raw.map(s => ({
    id: s.id,
    tipe: s.tipe,
    tingkat_kesulitan: s.tingkat_kesulitan,
    bobot: s.bobot,
    bab_id_text: s.bab_id_text,
    status: s.status,
    pertanyaan_text: htmlToPlainText(s.pertanyaan),
    pertanyaan_images: extractImages(s.pertanyaan),
    pilihan: s.pilihan?.map((p, i) => ({
      id: p.id,
      teks_plain: htmlToPlainText(p.teks),
      benar: p.benar,
      gambar_url: s.pilihan_gambar?.[i] ?? null,
    })) ?? null,
  }))
}

export function downloadJSON(soalList: SoalDownload[], filename: string): void {
  const blob = new Blob([JSON.stringify(soalList, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.json`
  a.click()
  URL.revokeObjectURL(url)
}
