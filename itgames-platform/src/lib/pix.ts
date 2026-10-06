// Geração do "Pix copia e cola" (BR Code estático) com CRC16, conforme o manual do Banco Central.

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nome e cidade do BR Code: sem acentos, maiúsculos, só letras/números/espaço
function normalize(text: string, maxLength: number, fallback: string): string {
  const clean = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, maxLength);
  return clean || fallback;
}

export interface PixPayloadInput {
  key: string;
  beneficiary?: string;
  city?: string;
  amount?: number;
  txid?: string;
}

export function buildPixPayload({ key, beneficiary, city, amount, txid }: PixPayloadInput): string {
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key.trim());
  const reference = (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  const payload =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount && amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', normalize(beneficiary || '', 25, 'BENEFICIARIO')) +
    tlv('60', normalize(city || '', 15, 'BRASIL')) +
    tlv('62', tlv('05', reference)) +
    '6304';

  return payload + crc16(payload);
}
