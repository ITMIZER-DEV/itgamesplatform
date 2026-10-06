// Adequação automática da imagem (banner) do campeonato antes do envio:
// recorte centralizado em 3:1, no máximo 1920 px de largura, JPG otimizado.

export const BANNER_RATIO = 3; // largura : altura
export const BANNER_MAX_WIDTH = 1920;
export const BANNER_MAX_HEIGHT = BANNER_MAX_WIDTH / BANNER_RATIO; // 640
export const BANNER_MIN_RECOMMENDED_WIDTH = 1200;
export const BANNER_TARGET_BYTES = 500 * 1024;
export const BANNER_MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export interface BannerCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  outWidth: number;
  outHeight: number;
  // fração da área original que foi descartada pelo recorte (0 a 1)
  cutFraction: number;
}

// Recorte centralizado na proporção do banner, sem aumentar a imagem além do original.
export function computeBannerCrop(width: number, height: number): BannerCrop {
  let sw = width;
  let sh = height;
  if (width / height > BANNER_RATIO) {
    sw = height * BANNER_RATIO;
  } else {
    sh = width / BANNER_RATIO;
  }
  const outWidth = Math.round(Math.min(BANNER_MAX_WIDTH, sw));
  const outHeight = Math.round(outWidth / BANNER_RATIO);
  return {
    sx: (width - sw) / 2,
    sy: (height - sh) / 2,
    sw,
    sh,
    outWidth,
    outHeight,
    cutFraction: 1 - (sw * sh) / (width * height),
  };
}

export interface PreparedBanner {
  file: File;
  previewUrl: string;
  summary: string;
  warning?: string;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar o JPG'))), 'image/jpeg', quality);
  });
}

export async function prepareBanner(original: File): Promise<PreparedBanner> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível ler esta imagem. Use um arquivo JPG, PNG ou WebP válido.');
  }

  const crop = computeBannerCrop(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = crop.outWidth;
  canvas.height = crop.outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Seu navegador não conseguiu processar a imagem.');
  }

  // JPG não tem transparência: fundo branco para PNG/WebP transparentes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.outWidth, crop.outHeight);
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  bitmap.close();

  // qualidade 85%, reduzindo aos poucos se passar de ~500 KB (mínimo 60%)
  let quality = 0.85;
  let blob = await toJpegBlob(canvas, quality);
  while (blob.size > BANNER_TARGET_BYTES && quality > 0.6) {
    quality = Math.round((quality - 0.05) * 100) / 100;
    blob = await toJpegBlob(canvas, quality);
  }

  const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' });
  const warnings: string[] = [];
  if (crop.sw < BANNER_MIN_RECOMMENDED_WIDTH) {
    warnings.push(
      `A imagem original é pequena (${originalWidth}×${originalHeight}). Para ficar nítida, use ao menos ${BANNER_MIN_RECOMMENDED_WIDTH} px de largura.`,
    );
  }
  if (crop.cutFraction > 0.35) {
    warnings.push('Boa parte da imagem foi cortada para caber na proporção 3:1. Confira a prévia.');
  }

  return {
    file,
    previewUrl: URL.createObjectURL(blob),
    summary: `Original ${originalWidth}×${originalHeight} (${formatBytes(original.size)}) → será enviado ${crop.outWidth}×${crop.outHeight} JPG (${formatBytes(blob.size)})`,
    warning: warnings.length ? warnings.join(' ') : undefined,
  };
}
