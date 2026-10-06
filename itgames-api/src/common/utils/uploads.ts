import { join } from 'path';

// Pasta das imagens enviadas (banners). Em produção, monte um volume aqui.
export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
}

// Identifica o formato pelo conteúdo real do arquivo (não pelo nome nem pelo tipo informado).
export function detectImageExtension(buf: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return null;
}
