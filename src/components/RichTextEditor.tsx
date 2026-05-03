"use client"

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { 
  Bold, Italic, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, 
  Image as ImageIcon,
  Upload
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function RichTextEditor({ content, onChange, placeholder = "Write something..." }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3",
      },
    },
  })

  useEffect(() => {
    if (editor && content === "") {
      editor.commands.setContent("")
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        editor.chain().focus().setImage({ src: existing.image_url }).run()
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

      editor.chain().focus().setImage({ src: publicUrl }).run()
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="border rounded-md" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}>
      <div className="flex gap-1 p-2 border-b flex-wrap" style={{ borderColor: "var(--color-border)" }}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive("bold") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive("italic") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive("strike") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        
        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
        
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive({ textAlign: "left" }) ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive({ textAlign: "center" }) ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive({ textAlign: "right" }) ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive({ textAlign: "justify" }) ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>
        
        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive("bulletList") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${editor.isActive("orderedList") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        
        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
        
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
          id="image-upload-input"
        />
        <label
          htmlFor="image-upload-input"
          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${uploading ? "opacity-50" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Upload Image"
        >
          {uploading ? <Upload className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </label>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}