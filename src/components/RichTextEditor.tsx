"use client"

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Underline from '@tiptap/extension-underline'
import {
  Bold, Italic, Strikethrough, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered,
  Image as ImageIcon,
  Upload,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  mini?: boolean
}

const MathFraction = Node.create({
  name: 'mathFraction',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      num: { default: '' },
      den: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-math-frac]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-math-frac': '', class: 'math-frac' }),
      ['span', { class: 'math-num' }, node.attrs.num],
      ['span', { class: 'math-den' }, node.attrs.den],
    ]
  },
})

async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function RichTextEditor({ content, onChange, placeholder = "Write something...", mini = false }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false)
  const [showFracPopover, setShowFracPopover] = useState(false)
  const [fracNum, setFracNum] = useState("")
  const [fracDen, setFracDen] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Superscript,
      Subscript,
      MathFraction,
      ...(mini ? [] : [
        Image.configure({ inline: true, allowBase64: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ]),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: mini
          ? "focus:outline-none min-h-[38px] px-3 py-2 text-sm"
          : "prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3",
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

  const insertFraction = () => {
    if (!fracNum && !fracDen) return
    editor.chain().focus().insertContent({
      type: 'mathFraction',
      attrs: { num: fracNum || '□', den: fracDen || '□' },
    }).run()
    setFracNum("")
    setFracDen("")
    setShowFracPopover(false)
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
      const { error: uploadError } = await supabase.storage
        .from('soal-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) { console.error('Upload error:', uploadError); setUploading(false); return }

      const { data: { publicUrl } } = supabase.storage.from('soal-images').getPublicUrl(fileName)
      await supabase.from('psat_image_uploads').insert({
        file_name: file.name, file_size: file.size, file_hash: fileHash, image_url: publicUrl,
      })
      editor.chain().focus().setImage({ src: publicUrl }).run()
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const btnBase = `p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800`
  const btnActive = "bg-gray-200 dark:bg-gray-700"
  const sep = <div className="w-px bg-gray-300 dark:bg-gray-600 mx-0.5" />

  const mathButtons = (
    <>
      <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()}
        className={`${btnBase} ${editor.isActive("superscript") ? btnActive : ""}`}
        style={{ color: "var(--color-foreground)" }} title="Pangkat (Superscript)">
        <SuperscriptIcon className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()}
        className={`${btnBase} ${editor.isActive("subscript") ? btnActive : ""}`}
        style={{ color: "var(--color-foreground)" }} title="Subscript">
        <SubscriptIcon className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().insertContent('°').run()}
        className={btnBase}
        style={{ color: "var(--color-foreground)", fontWeight: 700, fontSize: "14px", lineHeight: 1 }}
        title="Derajat (°)">
        °
      </button>
      <div className="relative">
        <button type="button" onClick={() => setShowFracPopover(v => !v)}
          className={`${btnBase} ${showFracPopover ? btnActive : ""}`}
          style={{ color: "var(--color-foreground)" }} title="Pecahan">
          <span style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1, fontFamily: "serif" }}>a/b</span>
        </button>
        {showFracPopover && (
          <div
            className="absolute top-full left-0 mt-1 z-20 p-3 rounded-md border shadow-lg flex flex-col gap-2"
            style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", minWidth: "150px" }}
          >
            <input autoFocus placeholder="Pembilang" value={fracNum}
              onChange={e => setFracNum(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
            />
            <div className="w-full border-t" style={{ borderColor: "var(--color-foreground)" }} />
            <input placeholder="Penyebut" value={fracDen}
              onChange={e => setFracDen(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && insertFraction()}
              className="border rounded px-2 py-1 text-sm w-full"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
            />
            <button onClick={insertFraction} className="text-xs px-2 py-1 rounded text-center"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>
              Sisipkan
            </button>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="border rounded-md" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}>
      <div className="flex gap-0.5 p-1.5 border-b flex-wrap items-center" style={{ borderColor: "var(--color-border)" }}>
        {/* Bold, Italic, Underline always visible */}
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${btnBase} ${editor.isActive("bold") ? btnActive : ""}`}
          style={{ color: "var(--color-foreground)" }} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${btnBase} ${editor.isActive("italic") ? btnActive : ""}`}
          style={{ color: "var(--color-foreground)" }} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${btnBase} ${editor.isActive("underline") ? btnActive : ""}`}
          style={{ color: "var(--color-foreground)" }} title="Underline">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>

        {mini ? (
          /* Mini toolbar: just math */
          <>{sep}{mathButtons}</>
        ) : (
          /* Full toolbar */
          <>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`${btnBase} ${editor.isActive("strike") ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Strikethrough">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            {sep}

            <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className={`${btnBase} ${editor.isActive({ textAlign: "left" }) ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Align Left">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()}
              className={`${btnBase} ${editor.isActive({ textAlign: "center" }) ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Align Center">
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className={`${btnBase} ${editor.isActive({ textAlign: "right" }) ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Align Right">
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              className={`${btnBase} ${editor.isActive({ textAlign: "justify" }) ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Justify">
              <AlignJustify className="w-3.5 h-3.5" />
            </button>

            {sep}

            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`${btnBase} ${editor.isActive("bulletList") ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Bullet List">
              <List className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`${btnBase} ${editor.isActive("orderedList") ? btnActive : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Numbered List">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            {sep}

            {mathButtons}

            {sep}

            <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageUpload} className="hidden" id="image-upload-input" />
            <label htmlFor="image-upload-input"
              className={`${btnBase} cursor-pointer ${uploading ? "opacity-50" : ""}`}
              style={{ color: "var(--color-foreground)" }} title="Upload Image">
              {uploading ? <Upload className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            </label>
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
