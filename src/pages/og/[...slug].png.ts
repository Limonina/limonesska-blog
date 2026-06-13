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

function card({ title, kind }: { title: string; kind: string }) {
  // размер заголовка подстраиваем под длину
  const fontSize = title.length > 70 ? 58 : title.length > 40 ? 70 : 84;
  return h('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', padding: '72px', backgroundColor: '#FAF8F5',
    color: '#2B2420', fontFamily: 'Manrope',
  }, [
    h('div', { display: 'flex', fontSize: 30, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#FF5C00' }, 'limonesska · Моя броня'),
    h('div', { display: 'flex', flexDirection: 'column' }, [
      kind ? h('div', { display: 'flex', fontSize: 26, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#2E7D6B', marginBottom: '20px' }, kind) : null,
      h('div', { display: 'flex', fontFamily: 'Playfair', fontSize, fontWeight: 700, lineHeight: 1.06, color: '#2B2420' }, title),
    ].filter(Boolean)),
    h('div', { display: 'flex', alignItems: 'center', fontSize: 26, color: '#9a9088', borderTop: '2px solid rgba(43,36,32,0.12)', paddingTop: '22px' }, 'limonesska.ru'),
  ]);
}

export async function getStaticPaths() {
  const blog = await getEntries('blog');
  const notes = await getEntries('notes');
  return [
    { params: { slug: 'site' }, props: { title: 'Моя броня', kind: '' } },
    ...blog.map((p) => ({ params: { slug: p.id }, props: { title: p.data.title, kind: 'Статья' } })),
    ...notes.map((n) => ({ params: { slug: n.id }, props: { title: n.data.title, kind: 'Заметка' } })),
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card(props as any) as any, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
