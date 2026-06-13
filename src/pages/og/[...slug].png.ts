import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { getEntries } from '../../utils/content';

// OG-превью для соцсетей: генерируются на сборке (satori → SVG → resvg → PNG).
// Маршрут /og/<slug>.png. Шрифты — woff из @fontsource (с кириллицей).

const FD = 'node_modules/@fontsource';
// Латиница — основное имя семейства; кириллица под отдельным именем (satori
// подхватит её как фолбэк для глифов, которых нет в латинском сабсете).
const fonts = [
  { name: 'Playfair', data: readFileSync(`${FD}/playfair-display/files/playfair-display-latin-700-normal.woff`), weight: 700, style: 'normal' },
  { name: 'PlayfairCyr', data: readFileSync(`${FD}/playfair-display/files/playfair-display-cyrillic-700-normal.woff`), weight: 700, style: 'normal' },
  { name: 'Manrope', data: readFileSync(`${FD}/manrope/files/manrope-latin-600-normal.woff`), weight: 600, style: 'normal' },
  { name: 'ManropeCyr', data: readFileSync(`${FD}/manrope/files/manrope-cyrillic-600-normal.woff`), weight: 600, style: 'normal' },
] as any;

// мини-хелпер вместо JSX (satori принимает React-подобные узлы)
const h = (type: string, style: any, children: any) => ({ type, props: { style, children } });

// логотип (тёмная тема) → растрируем в PNG-дата-URI один раз (satori надёжно ест растр)
const LOGO_H = 56;
const LOGO_W = Math.round(LOGO_H * (14369 / 3774)); // сохраняем пропорции
const logoSvg = readFileSync('src/assets/limonesska_logo_dark_theme.svg', 'utf-8');
const logoPng = new Resvg(logoSvg, { fitTo: { mode: 'height', value: LOGO_H * 2 }, background: 'rgba(0,0,0,0)' }).render().asPng();
const LOGO_URI = 'data:image/png;base64,' + Buffer.from(logoPng).toString('base64');
const logoNode = { type: 'img', props: { src: LOGO_URI, width: LOGO_W, height: LOGO_H } };

// звёзды-стадии (currentColor → подставляем цвет) → PNG-дата-URI по стадии
const STAR_COLOR = '#7FB8A4';
const starUri: Record<string, string> = {};
for (const s of ['base', 'advanced', 'max']) {
  const svg = readFileSync(`src/assets/icons/star_${s}.svg`, 'utf-8').replaceAll('currentColor', STAR_COLOR);
  const png = new Resvg(svg, { fitTo: { mode: 'height', value: 56 }, background: 'rgba(0,0,0,0)' }).render().asPng();
  starUri[s] = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
}

// звёзды на «ночном небе» (x, y, радиус, прозрачность) — фиксированная россыпь
const STARS: [number, number, number, number][] = [
  [110, 70, 2, 0.5], [240, 130, 1.5, 0.4], [60, 230, 2.5, 0.6], [180, 330, 1.5, 0.35],
  [90, 470, 2, 0.5], [320, 520, 1.5, 0.4], [520, 90, 2, 0.45], [690, 150, 3, 0.7],
  [840, 70, 1.5, 0.4], [1010, 250, 2, 0.5], [1120, 430, 2.5, 0.55], [980, 540, 1.5, 0.4],
  [1080, 110, 1.5, 0.35], [430, 60, 1.5, 0.4], [760, 560, 2, 0.5], [600, 470, 1.5, 0.35],
];

function card({ title, kind, desc, chips, stage, category }: { title: string; kind: string; desc?: string; chips?: string[]; stage?: string; category?: string }) {
  const fontSize = title.length > 70 ? 50 : title.length > 40 ? 62 : 76;
  const MOON = '#ECE3CF';
  return h('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', padding: '74px', position: 'relative', overflow: 'hidden',
    backgroundColor: '#10141A', backgroundImage: 'radial-gradient(circle at 78% 22%, #222b36 0%, #10141a 60%)',
    color: '#F1E8D6', fontFamily: 'Manrope',
  }, [
    // звёзды
    ...STARS.map(([x, y, r, o]) => h('div', {
      position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${r * 2}px`, height: `${r * 2}px`,
      borderRadius: '999px', backgroundColor: MOON, opacity: o,
    }, '')),
    // светящаяся луна (верх-право)
    h('div', { display: 'flex', position: 'absolute', top: '74px', right: '96px', width: '140px', height: '140px' }, [
      h('div', { position: 'absolute', width: '140px', height: '140px', borderRadius: '140px', backgroundColor: MOON, boxShadow: `0 0 55px 6px rgba(236,227,207,0.35)` }, ''),
    ]),
    // логотип (тёмная тема) — небольшой сдвиг, чтобы визуально совпасть с текстом ниже
    h('div', { display: 'flex', marginLeft: '2px' }, [logoNode]),
    // метка + заголовок + описание
    h('div', { display: 'flex', flexDirection: 'column', width: '1010px' }, [
      kind ? h('div', { display: 'flex', alignItems: 'center', marginBottom: '20px' }, [
        h('div', { display: 'flex', fontSize: 24, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#7FB8A4' }, kind),
        (stage && starUri[stage]) ? { type: 'img', props: { src: starUri[stage], width: 26, height: 26, style: { marginLeft: '16px', marginRight: '16px', position: 'relative', top: '1px' } } } : null,
        category ? h('div', { display: 'flex', fontSize: 24, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#8b94a0', marginLeft: (stage ? '0px' : '16px') }, category) : null,
      ].filter(Boolean)) : null,
      h('div', { display: 'flex', fontFamily: 'Playfair', fontSize, fontWeight: 700, lineHeight: 1.08, color: MOON }, title),
      desc ? h('div', { display: 'flex', fontSize: 30, fontWeight: 600, lineHeight: 1.4, color: '#A7A096', marginTop: '24px', maxWidth: '900px' }, desc) : null,
      (chips && chips.length) ? h('div', {
        display: 'flex', fontSize: 26, fontWeight: 600, letterSpacing: 1, color: '#9FA8B0', marginTop: '30px',
      }, chips.join('   ·   ')) : null,
    ].filter(Boolean)),
    // домен
    h('div', { display: 'flex', fontSize: 25, fontWeight: 600, letterSpacing: 1, color: '#8b94a0' }, 'limonesska.ru'),
  ]);
}

export async function getStaticPaths() {
  const blog = await getEntries('blog');
  const notes = await getEntries('notes');
  return [
    { params: { slug: 'site' }, props: { title: 'Моя броня', kind: '', desc: 'Личный блог-дневник: мысли, заметки, тех-эксперименты и немного астрологии.', chips: ['Блог', 'Заметки', 'Дневник', 'Проекты'] } },
    ...blog.map((p) => ({ params: { slug: p.id }, props: { title: p.data.title, kind: 'Статья', desc: p.data.description, stage: p.data.stage, category: p.data.category } })),
    ...notes.map((n) => ({ params: { slug: n.id }, props: { title: n.data.title, kind: 'Заметка', desc: n.data.description, stage: n.data.stage, category: n.data.category } })),
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card(props as any) as any, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
