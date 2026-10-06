'use client'
import { useState, useCallback } from 'react'
import { uploadFile } from '@/lib/storage'

export function useUpload() {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [downloadURL, setDownloadURL] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const upload = useCallback(async (file: File, path: string) => {
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const result = await uploadFile(file, path, setProgress)
      setDownloadURL(result.downloadURL)
      return result.downloadURL
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(0)
    setDownloadURL(null)
    setError(null)
  }, [])

  return { upload, progress, uploading, downloadURL, error, reset }
}
