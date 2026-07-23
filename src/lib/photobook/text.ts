/**
 * Текст в кривые: подписи и даты уходят в PDF векторными контурами, а не шрифтом.
 * Типографии это любят — шрифт не нужно вкладывать и нечему «поехать».
 */

import { parse, type Font } from 'opentype.js';

export type TextStyle = {
  /** кегль в мм */
  size: number;
  /** межстрочный интервал, множитель кегля */
  lineHeight: number;
  align: 'left' | 'center' | 'right';
};

const fontCache = new Map<string, Promise<Font>>();

function loadFont(url: string): Promise<Font> {
  let p = fontCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => parse(buf));
    fontCache.set(url, p);
  }
  return p;
}

/** Набор шрифтов-фолбэков: первый, у которого есть глиф, и рисует символ. */
export async function loadFonts(urls: string[]): Promise<Font[]> {
  return Promise.all(urls.map(loadFont));
}

function fontFor(fonts: Font[], ch: string): Font {
  for (const f of fonts) {
    const g = f.charToGlyph(ch);
    if (g && g.index !== 0) return f;
  }
  return fonts[0];
}

function widthOf(fonts: Font[], str: string, size: number): number {
  let w = 0;
  for (const ch of str) {
    const f = fontFor(fonts, ch);
    const g = f.charToGlyph(ch);
    w += (g.advanceWidth / f.unitsPerEm) * size;
  }
  return w;
}

/** Разбивает строку по словам под ширину блока. Пустая строка = абзацный отступ. */
export function wrapText(fonts: Font[], raw: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of raw.split(/\n/)) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(fonts, next, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export type GlyphRun = {
  /** SVG path data, координаты в мм относительно точки (x, baselineY), ось Y вниз */
  d: string;
  x: number;
  /** базовая линия, мм от верха блока */
  baseline: number;
};

/**
 * Готовит контуры текста внутри блока шириной boxW.
 * Возвращает пути и итоговую высоту блока (мм).
 */
export function textToPaths(
  fonts: Font[],
  content: string,
  boxW: number,
  style: TextStyle,
): { runs: GlyphRun[]; height: number } {
  const { size, lineHeight, align } = style;
  const lines = wrapText(fonts, content, size, boxW);
  const step = size * lineHeight;
  const runs: GlyphRun[] = [];

  lines.forEach((line, i) => {
    if (!line) return;
    const w = widthOf(fonts, line, size);
    const x = align === 'center' ? (boxW - w) / 2 : align === 'right' ? boxW - w : 0;
    const baseline = step * i + size; // первая базовая линия на кегль ниже верха

    // символ за символом — чтобы работал фолбэк по шрифтам
    let cursor = x;
    for (const ch of line) {
      const f = fontFor(fonts, ch);
      const g = f.charToGlyph(ch);
      const path = g.getPath(cursor, 0, size);
      const d = path.toPathData(3);
      if (d) runs.push({ d, x: 0, baseline });
      cursor += (g.advanceWidth / f.unitsPerEm) * size;
    }
  });

  return { runs, height: lines.length ? step * (lines.length - 1) + size * 1.25 : 0 };
}
