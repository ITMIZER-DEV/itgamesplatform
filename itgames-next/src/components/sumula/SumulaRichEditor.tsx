'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Image } from '@tiptap/extension-image'
import FontFamily from '@tiptap/extension-font-family'
import { Color } from '@tiptap/extension-color'
import { Extension } from '@tiptap/core'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  Eye, Edit3, Printer, Save, Loader2, Download, Type,
  Heading1, Heading2, List, ListOrdered, ImageIcon,
  Table as TableIcon, Trash2, Rows4, Columns4, Combine, Grid3x3, RefreshCw
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const TEMPLATE_VARS = [
  { tag: '#GAMENAME#', label: 'Nome do Game' },
  { tag: '#CATEGORYNAME#', label: 'Categoria' },
  { tag: '#REGISTERNUMBER#', label: 'Nº Inscrição' },
  { tag: '#TEAMNAME#', label: 'Nome da Equipe' },
  { tag: '#ATHLETE1_NAME#', label: 'Atleta 1' },
  { tag: '#ATHLETE2_NAME#', label: 'Atleta 2' },
  { tag: '#ATHLETE3_NAME#', label: 'Atleta 3' },
  { tag: '#EVENTTITLE#', label: 'Evento/WOD' },
  { tag: '#IDATLETA#', label: 'ID Atleta (Antigo)' },
  { tag: '#CATEGORIAATLETA#', label: 'Categoria (Antigo)' },
]

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
})

export const WordStyles = Extension.create({
  name: 'wordStyles',
  addOptions() {
    return {
      types: ['textStyle', 'paragraph', 'heading', 'table', 'tableRow', 'tableCell', 'tableHeader'],
    }
  },
  addGlobalAttributes() {
    const attrs = [
      'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
      'padding', 'margin', 'backgroundColor', 'writingMode', 'transform', 
      'verticalAlign', 'width', 'height', 'display'
    ]

    return [
      {
        types: this.options.types,
        attributes: attrs.reduce((acc, attr) => {
          acc[attr] = {
            default: null,
            parseHTML: (element: HTMLElement) => element.style[attr as any] || null,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes[attr]) return {}
              const cssAttr = attr.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
              return { style: `${cssAttr}: ${attributes[attr]}` }
            },
          }
          return acc
        }, {} as Record<string, any>),
      },
    ]
  },
})

export const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: 'table-bordered',
        parseHTML: (element: HTMLElement) => element.className || 'table-bordered',
        renderHTML: (attributes: Record<string, any>) => {
          return { class: attributes.class }
        },
      },
    }
  },
})

// ─── Função de substituição ───────────────────────────────────────────────────
function replaceVars(html: string, data: Record<string, string>): string {
  let result = html
  Object.entries(data).forEach(([key, value]) => {
    result = result.replaceAll(key, `<span class="sumula-var">${value}</span>`)
  })
  return result
}

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
      className={`p-1.5 rounded text-sm transition-colors ${active
        ? 'bg-primary text-primary-foreground'
        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        }`}
    >
      {children}
    </button>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SumulaRichEditorProps {
  gameCode: string
  eventId: string
  eventTitle?: string
  initialContent?: string
  previewData?: {
    gameName: string
    categoryName: string
    registerNumber: string
    teamName: string
    athletes: { name: string }[]
  }
  onSaved?: (html: string) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function SumulaRichEditor({
  gameCode, eventId, eventTitle, initialContent, previewData, onSaved
}: SumulaRichEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      FontSize,
      WordStyles,
      CustomTable.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
    ],
    content: initialContent || getDefaultTemplate(eventTitle),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[600px] p-8 focus:outline-none font-[Arial] text-black bg-white',
        style: 'font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5;'
      }
    }
  })

  // Atualiza preview quando muda de aba
  useEffect(() => {
    if (mode === 'preview' && editor && previewData) {
      const html = editor.getHTML()
      const data: Record<string, string> = {
        '#GAMENAME#': previewData.gameName,
        '#CATEGORYNAME#': previewData.categoryName,
        '#REGISTERNUMBER#': previewData.registerNumber,
        '#TEAMNAME#': previewData.teamName,
        '#ATHLETE1_NAME#': previewData.athletes[0]?.name || '___',
        '#ATHLETE2_NAME#': previewData.athletes[1]?.name || '___',
        '#ATHLETE3_NAME#': previewData.athletes[2]?.name || '___',
        '#EVENTTITLE#': eventTitle || '',
        // Aliases do template antigo
        '#IDATLETA#': `${previewData.registerNumber} - ${previewData.teamName}`,
        '#CATEGORIAATLETA#': previewData.categoryName,
      }
      setPreviewHtml(replaceVars(html, data))
    }
  }, [mode, editor, previewData, eventTitle])
  
  // Upload de imagem para o Firebase Storage
  const handleImageUpload = async (file: File) => {
    if (!editor) return
    const toastId = toast.loading('Fazendo upload da imagem...')
    try {
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storagePath = `sumulas/${gameCode}/${eventId}/${fileName}`
      const storageRef = ref(storage, storagePath)
      
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      editor.chain().focus().setImage({ src: downloadURL }).run()
      toast.success('Imagem enviada com sucesso!', { id: toastId })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Erro ao fazer upload da imagem: ' + error.message, { id: toastId })
    }
  }

  // Salvar template
  const handleSave = useCallback(async () => {
    if (!editor || !eventId) return
    setSaving(true)
    try {
      const html = editor.getHTML()
      await api.post(`events/template`, {
        game: gameCode,
        idEvent: eventId,
        content: html,
        type: 'html'
      })
      toast.success('Template salvo!')
      onSaved?.(html)
    } catch {
      toast.error('Erro ao salvar template')
    } finally {
      setSaving(false)
    }
  }, [editor, gameCode, eventId, onSaved])

  if (!editor) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Header: Toolbar + Tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex gap-1">
            <Button
              variant={mode === 'edit' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5 h-7"
              onClick={() => setMode('edit')}
            >
              <Edit3 className="h-3.5 w-3.5" /> Editor
            </Button>
            <Button
              variant={mode === 'preview' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5 h-7"
              onClick={() => setMode('preview')}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 hidden md:flex"
              onClick={() => window.print()}
              title="Abre a janela de impressão do Chrome"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir (Navegador)
            </Button>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 h-7 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={async () => {
                const element = document.querySelector('.print-area') as HTMLElement
                if (element) {
                  const toastId = toast.loading('Gerando PDF...', { duration: 10000 })
                  try {
                    // Import dinâmico para não quebrar no SSR build
                    const html2pdf = (await import('html2pdf.js')).default;
                    
                    const clone = element.cloneNode(true) as HTMLElement
                    clone.style.display = 'block'
                    clone.classList.remove('hidden', 'print:block')
                    
                    // Remover pageBreak explícito parar evitar página em branco no PDF isolado
                    const pages = clone.querySelectorAll('.sumula-page');
                    pages.forEach(p => {
                      (p as HTMLElement).style.pageBreakAfter = 'auto';
                      (p as HTMLElement).style.pageBreakBefore = 'auto';
                    });
                    
                    const container = document.createElement('div')
                    container.style.position = 'absolute'
                    container.style.left = '-9999px'
                    container.appendChild(clone)
                    document.body.appendChild(container)

                    const opt = {
                      margin:       0,
                      filename:     `sumulas-${(eventTitle || 'evento').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
                      image:        { type: 'jpeg' as const, quality: 0.98 },
                      html2canvas:  { scale: 2, useCORS: true },
                      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
                      pagebreak:    { mode: 'css', avoid: '.break-inside-avoid' }
                    }
                    
                    await html2pdf().set(opt).from(clone).save()
                    document.body.removeChild(container)
                    toast.success('Download do PDF concluído!', { id: toastId })
                  } catch (e) {
                    console.error('Erro PDF:', e)
                    toast.error('Erro ao gerar o download de PDF isolado.', { id: toastId })
                  }
                } else {
                  toast.error('Nenhum dado para gerar PDF. Selecione Atletas primeiro.')
                }
              }}
            >
              <Download className="h-3.5 w-3.5" /> Baixar PDF
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-7"
              disabled={saving || !eventId}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Toolbar (só no modo edição) */}
        {mode === 'edit' && (
          <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border">
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

            {/* Rotação de Texto (Vertical) */}
            <ToolbarBtn
              title="Texto Vertical (Deitado)"
              onClick={() => {
                if (editor.isActive('textStyle', { writingMode: 'vertical-rl' })) {
                  editor.chain().focus().setMark('textStyle', { writingMode: null, transform: null, display: null }).run()
                } else {
                  editor.chain().focus().setMark('textStyle', { writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'inline-block' }).run()
                }
              }}
              active={editor.isActive('textStyle', { writingMode: 'vertical-rl' })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </ToolbarBtn>

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarBtn title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
              <List className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarBtn>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Inserir Imagem Local */}
            <div className="relative">
              <input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Inserir Imagem do Computador"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleImageUpload(file)
                  }
                  e.target.value = ''
                }}
              />
              <ToolbarBtn title="Inserir Imagem Local" onClick={() => {}} active={false}>
                <ImageIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </div>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Controle de Tabelas */}
            <div className="flex items-center gap-0.5">
              <ToolbarBtn 
                title="Adicionar Tabela" 
                onClick={() => {
                  const cols = parseInt(window.prompt('Quantas colunas?', '3') || '0', 10)
                  if (!cols || cols < 1) return
                  const rows = parseInt(window.prompt('Quantas linhas?', '3') || '0', 10)
                  if (!rows || rows < 1) return
                  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
                }} 
                active={editor.isActive('table')}
              >
                <TableIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn 
                title="Ligar/Desligar Bordas" 
                onClick={() => {
                  const isBordered = editor.isActive('table', { class: 'table-bordered' }) || !editor.isActive('table', { class: 'table-invisible' });
                  editor.chain().focus().updateAttributes('table', { class: isBordered ? 'table-invisible' : 'table-bordered' }).run()
                }} 
                active={false}
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Mesclar Células" onClick={() => editor.chain().focus().mergeCells().run()} active={false}>
                <Combine className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Adicionar Linha Após" onClick={() => editor.chain().focus().addRowAfter().run()} active={false}>
                <Rows4 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Adicionar Coluna Após" onClick={() => editor.chain().focus().addColumnAfter().run()} active={false}>
                <Columns4 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Excluir Linha" onClick={() => editor.chain().focus().deleteRow().run()} active={false}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </ToolbarBtn>
              <ToolbarBtn title="Excluir Coluna" onClick={() => editor.chain().focus().deleteColumn().run()} active={false}>
                <Trash2 className="h-3.5 w-3.5 text-orange-500" />
              </ToolbarBtn>
            </div>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Inserir variável */}
            <select
              className="text-xs border border-input rounded px-1.5 py-1 bg-background text-foreground cursor-pointer"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  editor.chain().focus().insertContent(e.target.value).run()
                  e.target.value = ''
                }
              }}
            >
              <option value="" disabled>+ Inserir variável...</option>
              {TEMPLATE_VARS.map(v => (
                <option key={v.tag} value={v.tag}>{v.label} → {v.tag}</option>
              ))}
            </select>
          </div>
        )}

        {/* Editor ou Preview */}
        <div className="bg-gray-100 p-4 min-h-[650px]">
          {/* Folha A4 */}
          <div className="w-[210mm] min-h-[297mm] mx-auto shadow-lg">
            {mode === 'edit' ? (
              <EditorContent editor={editor} className="bg-white" />
            ) : (
              <div
                className="prose prose-sm max-w-none p-8 min-h-[600px] bg-white font-[Arial] text-black"
                style={{ fontFamily: 'Arial, sans-serif', fontSize: '12pt', lineHeight: '1.5' }}
                dangerouslySetInnerHTML={{ __html: previewHtml || editor.getHTML() }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Variáveis disponíveis */}
      <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs font-bold text-blue-900 dark:text-blue-100 mb-2">
          💡 Dica: Copie e cole do Word! As variáveis abaixo serão substituídas pelos dados reais:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARS.map(v => (
            <Badge
              key={v.tag}
              variant="outline"
              className="text-[10px] font-mono cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              onClick={() => {
                editor.chain().focus().insertContent(v.tag).run()
                toast.success(`${v.tag} inserida!`)
              }}
            >
              {v.tag}
              <span className="ml-1 text-muted-foreground not-italic">{v.label}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* CSS do Editor e Redimensionamento de Tabela */}
      <style>{`
        @media print {
          .w-\\[210mm\\] { box-shadow: none !important; }
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        .sumula-var {
          background: #fef3c7;
          border-radius: 3px;
          padding: 1px 3px;
          font-weight: bold;
        }
        .ProseMirror { min-height: 600px; }
        .ProseMirror:focus { outline: none; }
        
        /* TipTap Table CSS */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          box-sizing: border-box;
          position: relative;
        }
        /* Tabela com bordas (padrão) */
        .ProseMirror table.table-bordered td,
        .ProseMirror table.table-bordered th {
          border: 1px solid black;
        }
        /* Tabela sem bordas */
        .ProseMirror table.table-invisible td,
        .ProseMirror table.table-invisible th {
          border: 1px dashed #e2e8f0;
        }
        @media print {
          .ProseMirror table.table-invisible td,
          .ProseMirror table.table-invisible th {
            border: none !important;
          }
        }
        .sumula-content p, .sumula-content h1, .sumula-content h2, .sumula-content h3 {
          margin-top: 0.25em !important;
          margin-bottom: 0.25em !important;
        }
        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #adf;
          pointer-events: none;
        }
        .ProseMirror.resize-cursor {
          cursor: col-resize;
        }
      `}</style>
    </div>
  )
}

// ─── Template padrão ──────────────────────────────────────────────────────────
function getDefaultTemplate(eventTitle?: string): string {
  return `
<table style="width: 100%; border: none; margin-bottom: 10px;">
  <tbody>
    <tr>
      <td style="width: 20%; border: none; text-align: left; vertical-align: middle;">
        <h2>LOGO</h2>
      </td>
      <td style="width: 60%; border: none; text-align: center; vertical-align: middle;">
        <h1 style="color: #999; font-family: Impact, sans-serif; font-size: 24pt; margin: 0;">#GAMENAME#</h1>
      </td>
      <td style="width: 20%; border: none; text-align: right; vertical-align: middle;">
        <p style="font-size: 8pt; color: #666; margin: 0;">Presented by</p>
        <p><strong>Sponsor</strong></p>
      </td>
    </tr>
  </tbody>
</table>

<hr style="border-top: 2px solid #ccc; margin-top: 10px; margin-bottom: 20px;" />

<h1 style="font-size: 24pt; font-family: Impact, sans-serif; text-transform: uppercase; margin-bottom: 15px;">#EVENTTITLE#</h1>

<table style="width: 100%; border: none; margin-top: 10px;">
  <tbody>
    <tr>
      <td style="width: 40%; vertical-align: top; border: 2px solid #000; padding: 15px;">
        <p><strong><span style="text-decoration: underline; color: red;">Atleta</span> A</strong></p>
        <p>100 Single Unders<br>30 Wall Ball<br>10 Clean</p>
        <p><br></p>
        <p><strong><span style="text-decoration: underline; color: red;">Atleta</span> B</strong></p>
        <p>100 Single Unders<br>30 Wall Ball<br>10 Snatch</p>
        <p><br></p>
        <p><strong><span style="text-decoration: underline; color: red;">Atleta</span> A</strong></p>
        <p>100 Single Unders<br>30 Wall Ball<br>10 Clean n' Jerk</p>
        <p><br></p>
        <p><strong><span style="text-decoration: underline; color: red;">Atleta</span> B</strong></p>
        <p>100 Single Unders<br>30 Wall Ball<br>10 Squat Snatch</p>
      </td>
      <td style="width: 3%; border: none;"></td>
      <td style="width: 57%; vertical-align: top; border: none; padding: 0;">
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000;">
          <tbody>
            <tr>
              <td rowspan="3" style="width: 15%; border: 2px solid #000; text-align: center; vertical-align: middle; font-weight: bold;">
                <p style="text-align: center;">ROUND<br>1</p>
              </td>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">100 SINGLE UNDERS</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold;">100</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">30 WALL BALL</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold;">130</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">10 CLEAN</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold;">140</td>
            </tr>
            
            <tr>
              <td rowspan="3" style="width: 15%; border: 2px solid #000; text-align: center; vertical-align: middle; font-weight: bold;">
                <p style="text-align: center;">ROUND<br>2</p>
              </td>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">100 SINGLE UNDER</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">240</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">30 WALL BALL</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">270</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">10 SNATCH</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">280</td>
            </tr>
            
            <tr>
              <td rowspan="3" style="width: 15%; border: 2px solid #000; text-align: center; vertical-align: middle; font-weight: bold;">
                <p style="text-align: center;">ROUND<br>3</p>
              </td>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">100 SINGLE UNDER</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">380</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">30 WALL BALL</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">410</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">10 CLEAN N' JERK</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">420</td>
            </tr>
            
            <tr>
              <td rowspan="3" style="width: 15%; border: 2px solid #000; text-align: center; vertical-align: middle; font-weight: bold;">
                <p style="text-align: center;">ROUND<br>4</p>
              </td>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">100 SINGLE UNDER</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">520</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">30 WALL BALL</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">550</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">10 SQUAT SNATCH</td>
              <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold; color: #999;">560</td>
            </tr>
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 10px;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #ccc;"></div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

<p><br></p>
<table style="width: 100%; border: none;">
  <tbody>
    <tr>
      <td style="width: 70%; border: none;">
        <p style="font-size: 14pt;"><strong>DUPLA:</strong> <span style="font-weight: normal;">#REGISTERNUMBER# - #TEAMNAME#</span></p>
      </td>
      <td style="width: 30%; border: none; text-align: right;">
        <p style="font-size: 14pt;"><strong>SCORE:</strong> ______________________</p>
      </td>
    </tr>
  </tbody>
</table>

<p style="font-size: 14pt;"><strong>Atleta(s): :</strong> <span style="font-weight: normal;">#ATHLETE1_NAME# / #ATHLETE2_NAME#</span></p>
<p style="font-size: 14pt;"><strong>CATEGORIA:</strong> <span style="font-weight: normal;">#CATEGORYNAME#</span></p>
<p style="font-size: 14pt;"><strong>JUDGE:</strong> ____________________________________________________________________</p>
<p><br></p>
<p style="text-align: center; color: #666; font-size: 10pt; margin-top: 10px;">---------------------------------------------------------- via atleta ----------------------------------------------------------</p>
`
}
