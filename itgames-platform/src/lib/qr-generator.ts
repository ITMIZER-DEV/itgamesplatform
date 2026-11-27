/**
 * QR Code e código de barras em SVG (data URI) para as súmulas impressas.
 * O QR usa o codificador do qrcode.react (qrcodegen, padrão ISO 18004 com Reed-Solomon),
 * então qualquer leitor de celular decodifica a URL do juiz.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Gera o QR da URL em SVG vetorial. Nível M de correção aguenta amassado e respingo na prancheta.
 */
export function generateQrSvgDataUri(url: string, sizePx: number = 72): string {
  const svg = renderToStaticMarkup(
    createElement(QRCodeSVG, { value: url || 'https://itgames.com.br', size: sizePx, level: 'M', marginSize: 2 }),
  ).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Gera representação vetorial em SVG de Código de Barras (estilo Code 128)
 */
export function generateBarcodeSvgDataUri(code: string, width: number = 140, height: number = 24): string {
  try {
    const safeCode = code || 'SUMMER2026';
    const bars: { x: number; w: number }[] = [];
    let curX = 4;
    
    // Barras de início
    bars.push({ x: curX, w: 2 }); curX += 4;
    bars.push({ x: curX, w: 1 }); curX += 3;

    for (let i = 0; i < safeCode.length && curX < width - 14; i++) {
      const charCode = safeCode.charCodeAt(i);
      const w1 = (charCode % 2) + 1;
      const w2 = ((charCode >> 1) % 2) + 1.2;
      bars.push({ x: curX, w: w1 }); curX += w1 + 1.5;
      bars.push({ x: curX, w: w2 }); curX += w2 + 2;
    }

    // Barras de término
    bars.push({ x: curX, w: 2 }); curX += 3;
    bars.push({ x: curX, w: 1 });

    const rects = bars.map(b => `<rect x="${b.x.toFixed(1)}" y="2" width="${b.w.toFixed(1)}" height="${height - 11}" fill="#000000" />`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  ${rects}
  <text x="${width / 2}" y="${height - 1}" font-family="monospace" font-size="8" font-weight="bold" text-anchor="middle" fill="#000000">${safeCode}</text>
</svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (err) {
    console.error('[QrGenerator] Erro ao gerar Barcode SVG:', err);
    return '';
  }
}
