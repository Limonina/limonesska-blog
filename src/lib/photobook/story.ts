/**
 * «Итог месяца» картинкой для сторис — 1080 × 1920, та же сетка, что уходит в печать,
 * но оформленная под соцсети: тёплый фон, крупный заголовок, фото карточками с тенью.
 */

import { monthMatrix, RU_MONTHS, RU_WEEKDAYS, type MonthOpts } from './calendar';
import { drawPlaced, loadImage, type PhotoAsset, type Placement } from './render';

export const STORY_W = 1080;
export const STORY_H = 1920;

const PAD = 72;
const GAP = 12;

/** тёплая палитра сайта */
const C = {
  bgTop: '#f7f1e8',
  bgBottom: '#ece0d2',
  ink: '#221f1c',
  soft: '#8b8078',
  accent: '#d2603a',
  card: '#fffdfa',
};

export type StoryFonts = {
  display: string[];
  ui: string[];
};

const loaded = new Set<string>();

/** Подключает woff-файлы как шрифты canvas: кириллица и латиница отдельными начертаниями. */
async function ensureFonts(fonts: StoryFonts) {
  const jobs: Promise<unknown>[] = [];
  const add = (family: string, url: string, cyrillic: boolean) => {
    const tag = `${family}|${url}`;
    if (loaded.has(tag)) return;
    loaded.add(tag);
    const face = new FontFace(family, `url(${url})`, {
      unicodeRange: cyrillic ? 'U+0400-04FF' : 'U+0000-024F',
    });
    jobs.push(face.load().then((f) => document.fonts.add(f)));
  };
  fonts.display.forEach((u, i) => add('PB Display', u, i === 0));
  fonts.ui.forEach((u, i) => add('PB UI', u, i === 0));
  await Promise.all(jobs).catch(() => {});
}

export type StoryMonth = {
  year: number;
  month: number;
  cells: Record<number, Placement>;
  white?: Record<number, boolean>;
};

/** межбуквенное — есть не во всех браузерах, поэтому мягко */
function withTracking(ctx: CanvasRenderingContext2D, value: string, run: () => void) {
  const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = anyCtx.letterSpacing;
  if (prev !== undefined) anyCtx.letterSpacing = value;
  run();
  if (prev !== undefined) anyCtx.letterSpacing = prev;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export async function renderStory(
  m: StoryMonth,
  opts: MonthOpts,
  assets: Map<string, PhotoAsset>,
  fonts: StoryFonts,
): Promise<Blob> {
  await ensureFonts(fonts);

  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  // фон: тёплый градиент + едва заметное зерно, чтобы не выглядело «пустым белым»
  const bg = ctx.createLinearGradient(0, 0, STORY_W * 0.4, STORY_H);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  grain(ctx);

  const weeks = monthMatrix(m.year, m.month);
  const rows = weeks.length;
  const cell = (STORY_W - PAD * 2 - GAP * 6) / 7;
  const wdH = opts.showWeekdays ? 56 : 0;
  const headH = opts.showTitle ? 300 : 90;
  const footH = 40;

  const gridH = rows * cell + (rows - 1) * GAP;
  const top = Math.max(PAD, (STORY_H - (headH + wdH + gridH + footH)) / 2);
  const gridY = top + headH + wdH;

  if (opts.showTitle) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = C.accent;
    ctx.font = `28px "PB UI", sans-serif`;
    withTracking(ctx, '8px', () => ctx.fillText('ИТОГ МЕСЯЦА', STORY_W / 2, top + 46));

    ctx.fillStyle = C.ink;
    ctx.font = `132px "PB Display", serif`;
    ctx.fillText(RU_MONTHS[m.month], STORY_W / 2, top + 176);

    ctx.fillStyle = C.soft;
    ctx.font = `40px "PB Display", serif`;
    withTracking(ctx, '10px', () => ctx.fillText(String(m.year), STORY_W / 2, top + 232));

    // тонкая черта под заголовком
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(STORY_W / 2 - 40, top + 262);
    ctx.lineTo(STORY_W / 2 + 40, top + 262);
    ctx.stroke();
  }

  if (opts.showWeekdays) {
    ctx.fillStyle = C.soft;
    ctx.textAlign = 'center';
    ctx.font = `24px "PB UI", sans-serif`;
    withTracking(ctx, '3px', () => {
      RU_WEEKDAYS.forEach((label, i) => {
        ctx.fillText(label.toUpperCase(), PAD + i * (cell + GAP) + cell / 2, gridY - 18);
      });
    });
  }

  const radius = opts.rounded ? cell * 0.16 : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 7; c++) {
      const day = weeks[r][c];
      if (!day) continue;
      const x = PAD + c * (cell + GAP);
      const y = gridY + r * (cell + GAP);

      const pl = m.cells[day];
      const asset = pl ? assets.get(pl.photoId) : null;

      if (asset) {
        // карточка с мягкой тенью — фото «лежит» на бумаге
        ctx.save();
        ctx.shadowColor = 'rgba(60, 40, 25, 0.18)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = C.card;
        roundRectPath(ctx, x, y, cell, cell, radius);
        ctx.fill();
        ctx.restore();

        const img = await loadImage(asset.url);
        drawPlaced(ctx, img, x, y, cell, cell, pl, radius);
      } else {
        // пустой день — еле заметная клетка, чтобы ритм месяца читался
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRectPath(ctx, x, y, cell, cell, radius);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 95, 75, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (opts.showDayNumbers) {
        const size = Math.round(cell * 0.19);
        ctx.font = `${size}px "PB UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = asset ? (m.white?.[day] ? '#fff' : C.ink) : C.soft;
        ctx.fillText(String(day), x + size * 0.4, y + size * 1.2);
      }
    }
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

/** очень мягкое зерно: фон перестаёт быть «пластиковым» */
function grain(ctx: CanvasRenderingContext2D) {
  const tile = 160;
  const off = document.createElement('canvas');
  off.width = tile;
  off.height = tile;
  const octx = off.getContext('2d')!;
  const data = octx.createImageData(tile, tile);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 40;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 12;
  }
  octx.putImageData(data, 0, 0);
  const pattern = ctx.createPattern(off, 'repeat')!;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
}
