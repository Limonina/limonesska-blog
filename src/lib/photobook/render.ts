/**
 * Растровая подготовка фото под слот: кроп «cover» + ресемплинг под нужный dpi.
 * Работает в браузере через canvas — то же самое, что видно в превью, только в печатном разрешении.
 */

import { mmToPx } from './formats';

export type PhotoAsset = {
  id: string;
  name: string;
  /** object URL для превью и отрисовки */
  url: string;
  w: number;
  h: number;
};

/** Как фото сидит в слоте: масштаб поверх «cover», сдвиг центра (-1…1) и поворот. */
export type Placement = {
  photoId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  /** поворот по часовой: 0 / 90 / 180 / 270 */
  rotate: number;
};

export const defaultPlacement = (photoId: string): Placement => ({
  photoId,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotate: 0,
});

const imgCache = new Map<string, HTMLImageElement>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(url);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imgCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = url;
  });
}

/** Геометрия кропа: какой кусок исходника попадает в слот. */
export function coverRect(
  srcW: number,
  srcH: number,
  slotW: number,
  slotH: number,
  p: Placement,
) {
  const scale = Math.max(slotW / srcW, slotH / srcH) * p.scale;
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const freeX = Math.max(0, drawW - slotW) / 2;
  const freeY = Math.max(0, drawH - slotH) / 2;
  return {
    dx: (slotW - drawW) / 2 + freeX * p.offsetX,
    dy: (slotH - drawH) / 2 + freeY * p.offsetY,
    dw: drawW,
    dh: drawH,
  };
}

/**
 * Рисует фото в прямоугольник по правилу «cover» с учётом сдвига, зума и поворота.
 * Одна и та же математика работает и для печатного растра, и для картинки в сторис.
 * Возвращает посчитанный прямоугольник кадра.
 */
export function drawPlaced(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { naturalWidth: number; naturalHeight: number },
  x: number,
  y: number,
  w: number,
  h: number,
  p: Placement,
  radius = 0,
) {
  const clipped = radius > 0 && typeof ctx.roundRect === 'function';
  ctx.save();
  if (clipped) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
  }

  // при повороте на 90/270 стороны исходника меняются местами
  const rot = (((p.rotate ?? 0) % 360) + 360) % 360;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const sw = rot % 180 === 0 ? nw : nh;
  const sh = rot % 180 === 0 ? nh : nw;

  const r = coverRect(sw, sh, w, h, p);
  if (rot === 0) {
    ctx.drawImage(img, x + r.dx, y + r.dy, r.dw, r.dh);
  } else {
    const zoom = r.dw / sw;
    ctx.translate(x + r.dx + r.dw / 2, y + r.dy + r.dh / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, (-nw * zoom) / 2, (-nh * zoom) / 2, nw * zoom, nh * zoom);
  }
  ctx.restore();
  return r;
}

/**
 * Вырезает фото под слот в печатном разрешении.
 * Возвращает JPEG-байты (RGB) + фактический dpi — если исходник мельче, честно сообщаем.
 */
export async function rasterizeSlot(
  asset: PhotoAsset,
  slotWmm: number,
  slotHmm: number,
  dpi: number,
  p: Placement,
  /** радиус скругления углов, мм (0 — прямые углы). Углы заливаются белым: JPEG без прозрачности */
  radiusMm = 0,
  quality = 0.92,
): Promise<{ bytes: Uint8Array; px: number; py: number; effectiveDpi: number }> {
  const img = await loadImage(asset.url);
  const px = Math.max(1, mmToPx(slotWmm, dpi));
  const py = Math.max(1, mmToPx(slotHmm, dpi));

  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = py;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, px, py);

  const r = drawPlaced(ctx, img, 0, 0, px, py, p, mmToPx(radiusMm, dpi));
  const sw = ((p.rotate ?? 0) / 90) % 2 === 0 ? img.naturalWidth : img.naturalHeight;

  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', quality),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // сколько исходных пикселей реально пришлось на миллиметр слота
  const usedSrcW = sw * Math.min(1, px / r.dw) || sw;
  const effectiveDpi = Math.round((usedSrcW / slotWmm) * 25.4);

  return { bytes, px, py, effectiveDpi };
}
