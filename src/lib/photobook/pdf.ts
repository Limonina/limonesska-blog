/**
 * Сборка печатного PDF: страница = месяц, сетка дней, фото по датам.
 *
 * Что уже по-типографски:
 *  - физический лист = обрезной формат + вылеты (+ 5 мм под метки реза)
 *  - проставлены TrimBox / BleedBox / ArtBox — типография видит, где резать
 *  - метки реза «регистрационным» цветом (CMYK 100/100/100/100)
 *  - весь текст (месяц, дни недели, числа) — контурами, в CMYK. Шрифты не вкладываются
 *  - фото режутся под ячейку в 300 dpi, с предупреждением, если исходник мелкий
 *
 * Чего ещё нет (осознанно, точка врезки — convertToCmyk внизу):
 *  - фото пока в RGB (sRGB). Конвертация растра по ICC-профилю + PDF/X-1a —
 *    следующий шаг, ставится ровно в одном месте, вёрстку не трогает.
 */

import {
  PDFDocument,
  cmyk,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  type PDFPage,
} from 'pdf-lib';
import { MM_TO_PT, getFormat, pageGeom, type BookSettings } from './formats';
import {
  planSheets,
  sheetLayout,
  monthTitle,
  cellRadius,
  type MonthOpts,
  type Rect,
  type SplitMode,
} from './calendar';
import { rasterizeSlot, type PhotoAsset, type Placement } from './render';
import { loadFonts, textToPaths } from './text';
import type { Font } from 'opentype.js';

export type MonthPage = {
  year: number;
  /** 0–11 */
  month: number;
  /** день месяца → фото */
  cells: Record<number, Placement>;
  /** дни, где число печатается белым (тёмное фото под ним) */
  white?: Record<number, boolean>;
};

export type Book = {
  settings: BookSettings;
  opts: MonthOpts;
  split: SplitMode;
  /** месяцы книги по порядку; на листы их режет planSheets */
  months: MonthPage[];
};

export type FontSet = {
  /** заголовок месяца */
  display: string[];
  /** дни недели и числа */
  ui: string[];
};

export type BuildResult = {
  blob: Blob;
  warnings: string[];
};

/** запас под метки реза за вылетом, мм */
const MARK_SPACE = 5;
const MARK_LEN = 4;

const BLACK = cmyk(0, 0, 0, 1);
const WHITE = cmyk(0, 0, 0, 0);
const MUTED = cmyk(0, 0, 0, 0.55);
const HAIRLINE = cmyk(0, 0, 0, 0.25);

/** Контур скруглённого прямоугольника, координаты в мм, ось Y вниз. */
function roundedRectPath(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  return [
    `M ${rad} 0`,
    `H ${w - rad}`,
    `A ${rad} ${rad} 0 0 1 ${w} ${rad}`,
    `V ${h - rad}`,
    `A ${rad} ${rad} 0 0 1 ${w - rad} ${h}`,
    `H ${rad}`,
    `A ${rad} ${rad} 0 0 1 0 ${h - rad}`,
    `V ${rad}`,
    `A ${rad} ${rad} 0 0 1 ${rad} 0`,
    'Z',
  ].join(' ');
}

export async function buildPdf(
  book: Book,
  assets: Map<string, PhotoAsset>,
  fonts: FontSet,
  onProgress?: (done: number, total: number) => void,
): Promise<BuildResult> {
  const s = book.settings;
  const f = getFormat(s.format);
  const warnings: string[] = [];
  const k = MM_TO_PT;

  const markSpace = s.cropMarks ? MARK_SPACE : 0;
  /** отступ от края листа до обрезного блока, мм */
  const O = s.bleed + markSpace;
  const mediaW = f.trimW + O * 2;
  const mediaH = f.trimH + O * 2;

  const doc = await PDFDocument.create();
  doc.setTitle('Дневник · месячная сетка');
  doc.setProducer('limonesska · дневник');
  doc.setCreator('limonesska.ru');

  let uiFonts: Font[] = [];
  let dispFonts: Font[] = [];
  try {
    [uiFonts, dispFonts] = await Promise.all([loadFonts(fonts.ui), loadFonts(fonts.display)]);
  } catch {
    warnings.push('Шрифты не загрузились — текст в этот PDF не попал.');
  }

  const sheets = planSheets(book.months, book.split, f.trimW, f.trimH);
  const byMonth = new Map(book.months.map((m) => [`${m.year}-${m.month}`, m]));
  const total = sheets.length;

  for (let i = 0; i < total; i++) {
    const sheet = sheets[i];
    const mp = byMonth.get(`${sheet.year}-${sheet.month}`)!;
    const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
    const g = pageGeom(s, side);
    const geom = sheetLayout(g, sheet, book.opts);

    const page = doc.addPage([mediaW * k, mediaH * k]);
    setBoxes(page, mediaW, mediaH, f.trimW, f.trimH, O, s.bleed, k);

    /** мм от левого верхнего угла обрезного блока → координата PDF */
    const px = (xmm: number) => (O + xmm) * k;
    const py = (ymm: number) => (mediaH - O - ymm) * k;

    const drawText = (
      fontSet: Font[],
      content: string,
      box: Rect,
      size: number,
      align: 'left' | 'center' | 'right',
      color = BLACK,
      baselineShift = 0,
    ) => {
      if (!fontSet.length || !content) return;
      const { runs } = textToPaths(fontSet, content, box.w, { size, lineHeight: 1.2, align });
      for (const r of runs) {
        page.drawSvgPath(r.d, {
          x: px(box.x + r.x),
          y: py(box.y + r.baseline + baselineShift),
          scale: k,
          color,
          borderWidth: 0,
        });
      }
    };

    // заголовок месяца: на половине разворота — вертикально снизу вверх во внешнем поле
    if (geom.title && dispFonts.length) {
      const label = monthTitle(sheet.year, sheet.month);
      if (geom.titleInMargin) {
        const t = geom.title;
        const size = Math.min(14, t.w * 0.55);
        // поворот на 90° против часовой вокруг правого нижнего угла поля:
        // вдоль страницы текст идёт снизу вверх, буквы ложатся влево от этой линии
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(0, 1, -1, 0, px(t.x + t.w), py(t.y + t.h)),
        );
        const { runs } = textToPaths(dispFonts, label, t.h, {
          size,
          lineHeight: 1.2,
          align: 'left',
        });
        for (const r of runs) {
          page.drawSvgPath(r.d, {
            x: 0,
            y: (size - r.baseline) * k,
            scale: k,
            color: BLACK,
            borderWidth: 0,
          });
        }
        page.pushOperators(popGraphicsState());
      } else {
        drawText(dispFonts, label, geom.title, 9, 'left', BLACK, 2);
      }
    }

    // шапка дней недели
    for (const wd of geom.weekdays) {
      drawText(uiFonts, wd.label, wd.rect, 3, 'center', MUTED);
    }

    // ячейки дней
    for (const cell of geom.cells) {
      if (!cell.day) continue;
      const r = cell.rect;
      const pl = mp.cells[cell.day];
      const asset = pl ? assets.get(pl.photoId) : null;

      const radius = book.opts.rounded ? cellRadius(r.w, r.h) : 0;

      if (asset) {
        const { bytes, effectiveDpi } = await rasterizeSlot(asset, r.w, r.h, s.dpi, pl, radius);
        if (effectiveDpi < 200) {
          warnings.push(
            `${monthTitle(mp.year, mp.month)}, ${cell.day}-е: «${asset.name}» — ${effectiveDpi} dpi (для печати нужно от 250).`,
          );
        }
        const img = await doc.embedJpg(bytes);
        page.drawImage(img, { x: px(r.x), y: py(r.y + r.h), width: r.w * k, height: r.h * k });
      }

      // рамку рисуем всегда, даже под фото: по светлому кадру иначе не видно, где резать.
      // при скруглении — своим контуром, иначе прямые углы рамки съедали бы радиус
      if (radius > 0) {
        page.drawSvgPath(roundedRectPath(r.w, r.h, radius), {
          x: px(r.x),
          y: py(r.y),
          scale: k,
          borderColor: HAIRLINE,
          borderWidth: 0.3,
        });
      } else {
        page.drawRectangle({
          x: px(r.x),
          y: py(r.y + r.h),
          width: r.w * k,
          height: r.h * k,
          borderColor: HAIRLINE,
          borderWidth: 0.3,
        });
      }

      // число — в углу клетки, без подложки; на тёмном фото печатается вывороткой
      if (book.opts.showDayNumbers) {
        const color = mp.white?.[cell.day] ? WHITE : BLACK;
        drawText(uiFonts, String(cell.day), cell.numRect, geom.daySize, 'left', color);
      }
    }

    if (s.cropMarks) drawCropMarks(page, mediaH, f.trimW, f.trimH, O, s.bleed, k);

    onProgress?.(i + 1, total);
  }

  const bytes = await doc.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), warnings };
}

function setBoxes(
  page: PDFPage,
  mediaW: number,
  mediaH: number,
  trimW: number,
  trimH: number,
  O: number,
  bleed: number,
  k: number,
) {
  page.setMediaBox(0, 0, mediaW * k, mediaH * k);
  page.setBleedBox(
    (O - bleed) * k,
    (O - bleed) * k,
    (trimW + bleed * 2) * k,
    (trimH + bleed * 2) * k,
  );
  page.setTrimBox(O * k, O * k, trimW * k, trimH * k);
  page.setArtBox(O * k, O * k, trimW * k, trimH * k);
}

function drawCropMarks(
  page: PDFPage,
  mediaH: number,
  trimW: number,
  trimH: number,
  O: number,
  bleed: number,
  k: number,
) {
  const reg = cmyk(1, 1, 1, 1);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({
      start: { x: x1 * k, y: (mediaH - y1) * k },
      end: { x: x2 * k, y: (mediaH - y2) * k },
      thickness: 0.25,
      color: reg,
    });

  const l = O;
  const r = O + trimW;
  const t = O;
  const b = O + trimH;
  const out = bleed;
  const len = MARK_LEN;

  for (const x of [l, r]) {
    line(x, t - out, x, t - out - len);
    line(x, b + out, x, b + out + len);
  }
  for (const y of [t, b]) {
    line(l - out, y, l - out - len, y);
    line(r + out, y, r + out + len, y);
  }
}

/**
 * Точка врезки CMYK / PDF-X для растра.
 * Здесь RGB-PDF будет прогоняться через конвертер (Ghostscript-WASM или серверный)
 * с ICC-профилем типографии → PDF/X-1a, DeviceCMYK.
 */
export async function convertToCmyk(pdf: Blob): Promise<Blob> {
  return pdf;
}
