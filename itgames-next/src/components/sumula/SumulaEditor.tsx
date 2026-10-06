'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X, Download, Printer, Save, Edit, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface SumulaEditorProps {
  templateUrl: string | null
  onClose: () => void
  registrationData: {
    registerNumber: string
    teamName: string
    categoryName: string
    gameName: string
    eventTitle: string
    athletes: Array<{ name: string; cpf?: string }>
  }
}

export function SumulaEditor({ templateUrl, onClose, registrationData }: SumulaEditorProps) {
  console.log('🎨 SumulaEditor montado:', { templateUrl, registrationData })

  const [editMode, setEditMode] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Estados editáveis
  const [editableData, setEditableData] = useState(registrationData)

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '', 'height=842,width=595')
    if (!printWindow) return

    printWindow.document.write('<html><head><title>Súmula</title>')
    printWindow.document.write('<style>')
    printWindow.document.write(`
      @page { size: A4; margin: 0; }
      body { margin: 0; padding: 20mm; font-family: Arial, sans-serif; }
      .sumula-container { width: 100%; max-width: 210mm; margin: 0 auto; }
      .sumula-header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #000; padding-bottom: 10px; }
      .sumula-field { margin: 10px 0; font-size: 14px; }
      .sumula-field strong { display: inline-block; min-width: 150px; }
      .sumula-section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; background: #f9f9f9; }
      .athlete-item { padding: 5px 0; border-bottom: 1px dotted #ccc; }
    `)
    printWindow.document.write('</style></head><body>')
    printWindow.document.write(printContent.innerHTML)
    printWindow.document.write('</body></html>')
    printWindow.document.close()
    printWindow.print()
  }

  const handleDownloadPDF = async () => {
    toast.loading('Gerando PDF...')

    try {
      // Importar html2pdf dinamicamente (client-side only)
      const html2pdf = (await import('html2pdf.js')).default

      const element = printRef.current
      if (!element) return

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `sumula_${editableData.registerNumber}_${editableData.teamName}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      }

      await html2pdf().set(opt).from(element).save()

      toast.dismiss()
      toast.success('PDF gerado com sucesso!')
    } catch (error) {
      toast.dismiss()
      toast.error('Erro ao gerar PDF')
      console.error(error)
    }
  }

  const handleSave = () => {
    toast.success('Dados salvos!')
    setEditMode(false)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Preview e Edição da Súmula</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Painel de edição lateral */}
          <div className="w-80 flex-shrink-0 overflow-y-auto border-r pr-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase">Editar Dados</h3>
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                <Edit className="h-3 w-3 mr-1.5" />
                {editMode ? 'Visualizar' : 'Editar'}
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Número de Inscrição</Label>
                <Input
                  value={editableData.registerNumber}
                  onChange={(e) => setEditableData({ ...editableData, registerNumber: e.target.value })}
                  disabled={!editMode}
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs">Nome do Time</Label>
                <Input
                  value={editableData.teamName}
                  onChange={(e) => setEditableData({ ...editableData, teamName: e.target.value })}
                  disabled={!editMode}
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs">Categoria</Label>
                <Input
                  value={editableData.categoryName}
                  disabled
                  className="h-8 text-sm bg-muted"
                />
              </div>

              <div>
                <Label className="text-xs">Evento</Label>
                <Input
                  value={editableData.eventTitle}
                  disabled
                  className="h-8 text-sm bg-muted"
                />
              </div>

              <div className="pt-2 border-t">
                <Label className="text-xs font-bold">Atletas</Label>
                <div className="space-y-2 mt-2">
                  {editableData.athletes.map((athlete, index) => (
                    <div key={index} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Atleta #{index + 1}</Label>
                      <Input
                        value={athlete.name}
                        onChange={(e) => {
                          const newAthletes = [...editableData.athletes]
                          newAthletes[index].name = e.target.value
                          setEditableData({ ...editableData, athletes: newAthletes })
                        }}
                        disabled={!editMode}
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {editMode && (
                <Button onClick={handleSave} className="w-full gap-2" size="sm">
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              )}
            </div>
          </div>

          {/* Visualizador/Editor de Súmula */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Súmula Editável</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Gerar PDF
                </Button>
                <Button variant="default" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1.5" />
                  Imprimir
                </Button>
              </div>
            </div>

            {/* Área de Preview/Edição */}
            <div className="flex-1 overflow-auto bg-gray-100 p-6">
              <div
                ref={printRef}
                className="sumula-container bg-white shadow-lg mx-auto p-12"
                style={{ width: '210mm', minHeight: '297mm' }}
              >
                {/* Cabeçalho */}
                <div className="sumula-header text-center mb-6 pb-4 border-b-4 border-black">
                  <h1 className="text-3xl font-black uppercase mb-2">{editableData.gameName}</h1>
                  <h2 className="text-xl font-bold">{editableData.eventTitle}</h2>
                </div>

                {/* Dados Principais */}
                <div className="sumula-section mb-6">
                  <div className="sumula-field">
                    <strong>DUPLA:</strong> #{editableData.registerNumber} - {editableData.teamName}
                  </div>
                  <div className="sumula-field">
                    <strong>Atleta(s):</strong> {editableData.athletes.map((a, i) => (
                      <span key={i}>{i > 0 && ', '}{a.name}</span>
                    ))}
                  </div>
                  <div className="sumula-field">
                    <strong>CATEGORIA:</strong> {editableData.categoryName}
                  </div>
                </div>

                {/* Lista de Atletas Detalhada */}
                <div className="sumula-section mb-6">
                  <h3 className="font-bold text-lg mb-3 uppercase">Atletas:</h3>
                  {editableData.athletes.map((athlete, index) => (
                    <div key={index} className="athlete-item">
                      <strong>Atleta #{index + 1}:</strong> {athlete.name}
                    </div>
                  ))}
                </div>

                {/* Score */}
                <div className="sumula-section mb-6">
                  <div className="sumula-field">
                    <strong>SCORE:</strong>
                    <div className="border-b-2 border-black mt-2 pt-8"></div>
                  </div>
                </div>

                {/* Judge */}
                <div className="sumula-section">
                  <div className="sumula-field">
                    <strong>JUDGE:</strong>
                    <div className="border-b-2 border-black mt-2 pt-8"></div>
                  </div>
                </div>

                {/* Linha separadora "via atleta" */}
                <div className="my-8 text-center text-xs text-gray-500" style={{ borderTop: '1px dashed #999', paddingTop: '10px' }}>
                  ─────────────────────────────────────────── via atleta ───────────────────────────────────────────
                </div>

                {/* Cópia para o atleta (simplificada) */}
                <div className="mt-6">
                  <div className="sumula-field">
                    <strong>DUPLA:</strong> #{editableData.registerNumber} - {editableData.teamName}
                  </div>
                  <div className="sumula-field">
                    <strong>CATEGORIA:</strong> {editableData.categoryName}
                  </div>
                  <div className="sumula-field">
                    <strong>SCORE:</strong>
                    <div className="border-b border-black mt-2 pt-6"></div>
                  </div>
                  <div className="sumula-field">
                    <strong>JUDGE:</strong>
                    <div className="border-b border-black mt-2 pt-6"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
