/**
 * Месячная сетка: геометрия страницы в миллиметрах.
 * Неделя начинается с понедельника.
 *
 * Месяц ложится либо целиком на одну страницу (горизонтальный формат),
 * либо разрезается по колонкам на разворот: Пн–Ср слева, Чт–Вс справа
 * (так это выглядит в бумажных дневниках на вертикальном формате).
 */

import type { PageGeom } from './formats';

export const RU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const RU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Матрица месяца: массив недель по 7 ячеек, в ячейке — число или null. */
export function monthMatrix(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7; // Пн = 0
  const days = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let cur: (number | null)[] = new Array(shift).fill(null);
  for (let d = 1; d <= days; d++) {
    cur.push(d);
    if (cur.length === 7) {
      weeks.push(cur);
      cur = [];
    }
  }
  if (cur.length) weeks.push([...cur, ...new Array(7 - cur.length).fill(null)]);
  return weeks;
}

export type Rect = { x: number; y: number; w: number; h: number };

export type MonthOpts = {
  /** заголовок месяца */
  showTitle: boolean;
  /** строка «Пн Вт Ср…» */
  showWeekdays: boolean;
  /** числа в ячейках */
  showDayNumbers: boolean;
  /** скруглять углы фото */
  rounded: boolean;
};

/** радиус скругления фото в ячейке, мм */
export const cellRadius = (w: number, h: number) => Math.min(w, h) * 0.08;

/** Как месяц кладётся на бумагу. */
export type SplitMode = 'auto' | 'single' | 'spread';

/** Один физический лист: месяц целиком или его часть по колонкам дней. */
export type Sheet = {
  year: number;
  month: number;
  /** колонки недели на этом листе, 0 = Пн */
  colFrom: number;
  colTo: number;
  /** печатать ли на этом листе название месяца */
  title: boolean;
};

/** Разрезать ли месяц на разворот при таком формате. */
export function isSpread(mode: SplitMode, trimW: number, trimH: number): boolean {
  if (mode === 'single') return false;
  if (mode === 'spread') return true;
  return trimH > trimW; // вертикальный формат — месяц не влезает семью колонками
}

export function planSheets(
  months: { year: number; month: number }[],
  mode: SplitMode,
  trimW: number,
  trimH: number,
): Sheet[] {
  const spread = isSpread(mode, trimW, trimH);
  const sheets: Sheet[] = [];
  for (const m of months) {
    if (spread) {
      sheets.push({ ...m, colFrom: 0, colTo: 2, title: true });
      sheets.push({ ...m, colFrom: 3, colTo: 6, title: false });
    } else {
      sheets.push({ ...m, colFrom: 0, colTo: 6, title: true });
    }
  }
  return sheets;
}

export type MonthGeom = {
  title: Rect | null;
  weekdays: { label: string; rect: Rect }[];
  /** rect — клетка под фото, numRect — место числа в её верхнем углу */
  cells: { day: number | null; col: number; rect: Rect; numRect: Rect }[];
  /** кегль числа дня, мм */
  daySize: number;
  /** заголовок стоит во внешнем поле сбоку от сетки (половина разворота) */
  titleInMargin: boolean;
};

const TITLE_H = 16;
const WEEKDAY_H = 6;

export function sheetLayout(g: PageGeom, sheet: Sheet, o: MonthOpts): MonthGeom {
  const weeks = monthMatrix(sheet.year, sheet.month);
  const rows = weeks.length;
  const cols = sheet.colTo - sheet.colFrom + 1;
  /** лист — половина разворота (Пн–Ср или Чт–Вс) */
  const half = cols < 7;

  const withTitle = o.showTitle && sheet.title;
  // на развороте заголовок уходит во внешнее поле, а не над сеткой,
  // иначе строки на левой и правой странице не совпадут по высоте
  const titleH = withTitle && !half ? TITLE_H : 0;
  const wdH = o.showWeekdays ? WEEKDAY_H : 0;

  const gridY = g.top + titleH + wdH;
  const gridH = g.ch - titleH - wdH;

  // ширину ячейки задаёт страница с четырьмя колонками — тогда клетки
  // на обеих страницах разворота одинаковые
  const cw = half ? (g.cw - g.gap * 3) / 4 : (g.cw - g.gap * (cols - 1)) / cols;
  const chh = (gridH - g.gap * (rows - 1)) / rows;

  // число дня стоит в углу клетки, без подложки
  const daySize = Math.min(4.5, Math.max(2, cw * 0.12));

  const gridW = cw * cols + g.gap * (cols - 1);
  /** сетку из трёх колонок прижимаем к корешку — слева остаётся поле под название */
  const originX = half && sheet.colFrom === 0 ? g.left + (g.cw - gridW) : g.left;
  const colX = (c: number) => originX + (c - sheet.colFrom) * (cw + g.gap);

  const title: Rect | null = !withTitle
    ? null
    : half
      ? { x: g.left, y: gridY, w: Math.max(20, g.cw - gridW - g.gap * 2), h: g.ch - (gridY - g.top) }
      : { x: g.left, y: g.top, w: g.cw, h: TITLE_H };

  const weekdays = o.showWeekdays
    ? RU_WEEKDAYS.slice(sheet.colFrom, sheet.colTo + 1).map((label, i) => ({
        label,
        rect: { x: colX(sheet.colFrom + i), y: g.top + titleH, w: cw, h: WEEKDAY_H },
      }))
    : [];

  const cells: MonthGeom['cells'] = [];
  weeks.forEach((week, r) => {
    for (let c = sheet.colFrom; c <= sheet.colTo; c++) {
      cells.push({
        day: week[c],
        col: c,
        rect: { x: colX(c), y: gridY + r * (chh + g.gap), w: cw, h: chh },
        numRect: {
          x: colX(c) + daySize * 0.4,
          y: gridY + r * (chh + g.gap) + daySize * 0.35,
          w: cw,
          h: daySize * 1.3,
        },
      });
    }
  });

  return { title, weekdays, cells, daySize, titleInMargin: half };
}

export const monthTitle = (y: number, m: number) => `${RU_MONTHS[m]} ${y}`;
