import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Chave de 32 bytes: MAIL_ENCRYPTION_KEY, ou JWT_SECRET quando a primeira não existe
function key(): Buffer {
  return createHash('sha256')
    .update(process.env.MAIL_ENCRYPTION_KEY || process.env.JWT_SECRET || '')
    .digest();
}

// AES-256-GCM; formato "iv:tag:cipher" em base64
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join(':');
}

// Devolve null (nunca lança) quando o conteúdo está corrompido ou a chave mudou
export function decryptSecret(payload: string): string | null {
  try {
    const [iv, tag, enc] = payload.split(':').map((p) => Buffer.from(p, 'base64'));
    if (!iv?.length || !tag?.length || !enc) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
