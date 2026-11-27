import { describe, expect, it } from 'vitest';
import { generateQrSvgDataUri } from '@/lib/qr-generator';

describe('generateQrSvgDataUri', () => {
  const url = 'https://itgames.itmizer.com/judge?cat=2&wod=WOD%201-B&heat=1&lane=1&reg=2168';

  it('gera SVG em data URI com xmlns (sem ele a <img> não renderiza)', () => {
    const uri = generateQrSvgDataUri(url, 72);
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const svg = decodeURIComponent(uri.slice('data:image/svg+xml;utf8,'.length));
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="72"');
  });

  it('usa um QR de verdade: tamanho de versão padrão (21 + 4n módulos) e muda com a URL', () => {
    const svg = (u: string) => decodeURIComponent(generateQrSvgDataUri(u, 72));
    const modules = Number(/viewBox="0 0 (\d+) /.exec(svg(url))![1]) - 4; // margem de 2 de cada lado
    expect((modules - 21) % 4).toBe(0);
    expect(svg(url)).not.toEqual(svg(url.replace('lane=1', 'lane=2')));
  });
});
