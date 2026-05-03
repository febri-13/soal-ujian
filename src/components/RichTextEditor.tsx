"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { 
  Bold, Italic, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, 
  Image as ImageIcon
} from 'lucide-react'

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
      TextAlign.configure({
        types: ['heading', 'paragraph'],
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
        
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter image URL:")
            if (url) {
              editor.chain().focus().setImage({ src: url }).run()
            }
          }}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: "var(--color-foreground)" }}
          title="Insert Image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}