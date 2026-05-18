"use client"

import { useRef, useState, useId } from "react"
import { Image as ImageIcon, Upload, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
}

async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function ImageUpload({ value, onChange }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string>(value || "")
  const inputId = useId()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const fileHash = await calculateFileHash(file)
      const { data: existing } = await supabase
        .from('psat_image_uploads')
        .select('image_url')
        .eq('file_hash', fileHash)
        .maybeSingle()

      if (existing) {
        setPreview(existing.image_url)
        onChange(existing.image_url)
        setUploading(false)
        return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('soal-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setUploading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('soal-images')
        .getPublicUrl(fileName)

      await supabase.from('psat_image_uploads').insert({
        file_name: file.name,
        file_size: file.size,
        file_hash: fileHash,
        image_url: publicUrl,
      })

      setPreview(publicUrl)
      onChange(publicUrl)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setPreview("")
    onChange("")
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className={`p-2 rounded border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${uploading ? "opacity-50" : ""}`}
        style={{ borderColor: "var(--color-border)" }}
      >
        {uploading ? <Upload className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
      </label>
      {preview && (
        <>
          <button
            type="button"
            onClick={handleRemove}
            className="p-2 rounded border hover:bg-red-100 dark:hover:bg-red-900"
            style={{ borderColor: "var(--color-border)" }}
          >
            <X className="w-4 h-4" />
          </button>
          <img src={preview} alt="Preview" className="w-12 h-12 object-cover rounded border" />
        </>
      )}
    </div>
  )
}