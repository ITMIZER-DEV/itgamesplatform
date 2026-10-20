import { createHash, randomBytes } from 'crypto';

// Credencial do dispositivo: 32 bytes aleatórios; no banco guarda-se só o hash.
export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
