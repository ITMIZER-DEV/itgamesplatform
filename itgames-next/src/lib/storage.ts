import { storage } from './firebase'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

export interface UploadResult {
  downloadURL: string
  path: string
}

export async function uploadFile(
  file: File,
  path: string,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  onProgress(0)

  const storageRef = ref(storage, path)
  const uploadTask = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress(progress)
      },
      (error) => {
        console.error('Erro no upload Firebase:', error)
        reject(error)
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        onProgress(100)
        resolve({ downloadURL, path })
      }
    )
  })
}
