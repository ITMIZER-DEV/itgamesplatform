'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Table as TiptapTable } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Image as TiptapImage } from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ImageIcon, Table as TableIcon, 
  Heading1, Heading2, Trash2, Rows4, Columns4, Combine, Grid3x3
} from 'lucide-react'

// ─── Botão de toolbar ─────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick, active, children, title
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        "p-1.5 rounded text-sm transition-colors",
        active 
          ? "bg-orange-500 text-white" 
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '200px'
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      TiptapTable.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TiptapImage.configure({ inline: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none p-4 focus:outline-none bg-background text-foreground',
          className
        ),
        style: `min-height: ${minHeight};`
      }
    }
  })

  // Sincronizar valor se necessário (opcional para evitar loop se o estado mudar externamente)
  // useEffect(() => {
  //   if (editor && value !== editor.getHTML()) {
  //     editor.commands.setContent(value)
  //   }
  // }, [value, editor])

  if (!editor) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border bg-muted/30">
        <ToolbarBtn title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Sublinhado" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn title="Alinhar à esquerda" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Centralizar" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Alinhar à direita" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Tabelas */}
        <ToolbarBtn 
          title="Inserir Tabela" 
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} 
          active={editor.isActive('table')}
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        
        {editor.isActive('table') && (
          <>
            <ToolbarBtn title="Mesclar Células" onClick={() => editor.chain().focus().mergeCells().run()} active={false}>
              <Combine className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn title="Add Linha" onClick={() => editor.chain().focus().addRowAfter().run()} active={false}>
              <Rows4 className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn title="Add Coluna" onClick={() => editor.chain().focus().addColumnAfter().run()} active={false}>
              <Columns4 className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn title="Excluir" onClick={() => editor.chain().focus().deleteTable().run()} active={false}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </ToolbarBtn>
          </>
        )}

        {/* Imagem (Upload Base64 rápido) */}
        <div className="relative ml-auto">
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (ev) => {
                  if (ev.target?.result && typeof ev.target.result === 'string') {
                    editor.chain().focus().setImage({ src: ev.target.result }).run()
                  }
                }
                reader.readAsDataURL(file)
              }
              e.target.value = ''
            }}
          />
          <ToolbarBtn title="Inserir Imagem" onClick={() => {}} active={false}>
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
      </div>

      <div className="relative">
        <EditorContent editor={editor} />
        {!editor.getHTML() && placeholder && (
          <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none text-sm italic">
            {placeholder}
          </div>
        )}
      </div>

      <style jsx global>{`
        .prose table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          border: 1px solid #e2e8f0;
        }
        .prose table td,
        .prose table th {
          border: 1px solid #e2e8f0;
          padding: 8px;
          min-width: 1em;
          position: relative;
        }
        .dark .prose table,
        .dark .prose table td,
        .dark .prose table th {
          border-color: #334155;
        }
        .prose table th {
          background-color: #f8fafc;
          font-weight: bold;
        }
        .dark .prose table th {
          background-color: #1e293b;
        }
        .ProseMirror {
          outline: none !important;
        }
      `}</style>
    </div>
  )
}
