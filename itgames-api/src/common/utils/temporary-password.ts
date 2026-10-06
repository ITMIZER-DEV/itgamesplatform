import { randomBytes } from 'crypto';

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar o repasse por WhatsApp
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
