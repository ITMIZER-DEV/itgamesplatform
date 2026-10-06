'use client'
import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useUpload } from '@/hooks/useUpload'
import { getCroppedBlob } from '@/lib/cropImage'
import { cn } from '@/lib/utils'

interface Props {
  storagePath: string
  onUploaded: (url: string) => void
  onUploadingChange?: (uploading: boolean) => void
  currentImageUrl?: string
  label?: string
}

export function ImageUploader({ storagePath, onUploaded, onUploadingChange, currentImageUrl, label = 'Imagem de capa' }: Props) {
  const { upload, progress, uploading, downloadURL, error: uploadError } = useUpload()

  const [rawSrc, setRawSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted[0]) return
    const reader = new FileReader()
    reader.onload = () => setRawSrc(reader.result as string)
    reader.readAsDataURL(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: uploading,
  })

  const handleCropConfirm = async () => {
    if (!rawSrc || !croppedAreaPixels) return
    onUploadingChange?.(true)
    try {
      const blob = await getCroppedBlob(rawSrc, croppedAreaPixels)
      const filename = `${Date.now()}_cover.jpg`
      const file = new File([blob], filename, { type: 'image/jpeg' })
      const path = `${storagePath}/${filename}`
      const url = await upload(file, path)
      if (url) onUploaded(url)
    } catch (err) {
      console.error('[ImageUploader] crop/upload failed:', err)
    } finally {
      setRawSrc(null)
      onUploadingChange?.(false)
    }
  }

  const displayUrl = downloadURL ?? currentImageUrl

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>

      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed transition-colors',
          isDragActive
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
          uploading && 'cursor-wait opacity-70'
        )}
      >
        <input {...getInputProps()} />

        {displayUrl ? (
          <div className="relative">
            <img
              src={displayUrl}
              alt="Preview"
              className="h-48 w-full rounded-xl object-cover"
            />
            {!uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-sm text-white font-medium flex items-center gap-1.5">
                  <Upload className="h-4 w-4" /> Trocar imagem
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Upload className="h-8 w-8" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragActive ? 'Solte aqui!' : 'Arraste uma imagem ou clique para selecionar'}
              </p>
              <p className="text-xs mt-0.5">JPG, PNG, WEBP — máx. 5MB</p>
            </div>
          </div>
        )}
      </div>

      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Enviando...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {uploadError && !uploading && (
        <p className="text-xs text-destructive">
          Erro ao enviar imagem: {uploadError.message}
        </p>
      )}

      {/* Crop modal */}
      <Dialog open={!!rawSrc} onOpenChange={(open: boolean) => { if (!open) setRawSrc(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recortar imagem</DialogTitle>
          </DialogHeader>

          <div className="relative h-72 w-full rounded-lg overflow-hidden bg-black">
            {rawSrc && (
              <Cropper
                image={rawSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Zoom</p>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRawSrc(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCropConfirm} disabled={!croppedAreaPixels}>
              Confirmar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
