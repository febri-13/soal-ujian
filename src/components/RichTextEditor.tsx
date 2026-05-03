"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ content, onChange, placeholder = "Write something..." }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3",
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="border rounded-md" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}>
      <div className="flex gap-1 p-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded ${editor.isActive("bold") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded ${editor.isActive("italic") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded ${editor.isActive("strike") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded ${editor.isActive("heading", { level: 2 }) ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded ${editor.isActive("bulletList") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded ${editor.isActive("orderedList") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
          style={{ color: "var(--color-foreground)" }}
          title="Numbered List"
        >
          1.
        </button>
        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter image URL:")
            if (url) {
              editor.chain().focus().setImage({ src: url }).run()
            }
          }}
          className="p-1.5 rounded"
          style={{ color: "var(--color-foreground)" }}
          title="Insert Image"
        >
          📷
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}