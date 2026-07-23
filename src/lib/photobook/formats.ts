/**
 * Форматы книги и геометрия страницы. Все размеры — в миллиметрах.
 *
 * Терминология печати:
 *  - trim  — размер готовой страницы после обрезки (то, что держишь в руках)
 *  - bleed — вылет: фон/фото выходят за trim, чтобы при неточной резке не было белой каёмки
 *  - media — физический лист в PDF = trim + вылеты со всех сторон
 *  - safe  — внутреннее поле: ближе к краю ничего важного не ставим
 */

export type FormatId = 'a4p' | 'a4l' | 'a5p' | 'a5l' | 'sq20' | 'sq15';

export type BookFormat = {
  id: FormatId;
  name: string;
  hint: string;
  /** ширина/высота страницы после обрезки, мм */
  trimW: number;
  trimH: number;
};

export const FORMATS: BookFormat[] = [
  { id: 'a4p', name: 'A4 книжная', hint: '210 × 297 мм', trimW: 210, trimH: 297 },
  { id: 'a4l', name: 'A4 альбомная', hint: '297 × 210 мм', trimW: 297, trimH: 210 },
  { id: 'a5p', name: 'A5 книжная', hint: '148 × 210 мм', trimW: 148, trimH: 210 },
  { id: 'a5l', name: 'A5 альбомная', hint: '210 × 148 мм', trimW: 210, trimH: 148 },
  { id: 'sq20', name: 'Квадрат 20', hint: '200 × 200 мм', trimW: 200, trimH: 200 },
  { id: 'sq15', name: 'Квадрат 15', hint: '150 × 150 мм', trimW: 150, trimH: 150 },
];

export type BookSettings = {
  format: FormatId;
  /** вылет, мм (типовое требование типографий — 3 или 5) */
  bleed: number;
  /** внешнее поле до фото/текста, мм */
  margin: number;
  /** внутреннее поле у корешка (обычно больше внешнего — часть уходит в переплёт), мм */
  gutter: number;
  /** зазор между фото в сетке, мм */
  gap: number;
  /** разрешение растровых вставок */
  dpi: number;
  /** метки реза за пределами trim */
  cropMarks: boolean;
};

export const DEFAULT_SETTINGS: BookSettings = {
  format: 'a4p',
  bleed: 3,
  margin: 12,
  gutter: 16,
  gap: 4,
  dpi: 300,
  cropMarks: true,
};

/** Геометрия конкретной страницы: развёрнутые размеры + поля с учётом стороны разворота. */
export type PageGeom = {
  trimW: number;
  trimH: number;
  bleed: number;
  gap: number;
  /** поля контентной области от края trim */
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** контентная область */
  cw: number;
  ch: number;
  side: 'left' | 'right';
};

export function getFormat(id: FormatId): BookFormat {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export function pageGeom(s: BookSettings, side: 'left' | 'right'): PageGeom {
  const f = getFormat(s.format);
  // корешок: у левой страницы он справа, у правой — слева
  const left = side === 'right' ? s.gutter : s.margin;
  const right = side === 'right' ? s.margin : s.gutter;
  return {
    trimW: f.trimW,
    trimH: f.trimH,
    bleed: s.bleed,
    gap: s.gap,
    top: s.margin,
    bottom: s.margin,
    left,
    right,
    cw: f.trimW - left - right,
    ch: f.trimH - s.margin - s.margin,
    side,
  };
}

export const MM_TO_PT = 72 / 25.4;
export const mmToPt = (mm: number) => mm * MM_TO_PT;
export const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
