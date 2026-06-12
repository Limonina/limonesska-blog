import type { APIRoute } from 'astro';
import { getEntries } from '../utils/content';

// Индекс для клиентского поиска: заголовок + описание + теги + ПОЛНЫЙ текст
// записи (для поиска «по всему»), по статьям, заметкам и дневнику.

// Грубая чистка markdown/HTML до простого текста (для поиска и сниппетов)
const toText = (md = '') =>
  md
    .replace(/<[^>]+>/g, ' ') // html-теги
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ') // код
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // картинки
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // ссылки → текст
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const GET: APIRoute = async () => {
  const blog = await getEntries('blog');
  const notes = await getEntries('notes');
  const diary = await getEntries('diary');

  const fmt = (d: Date) =>
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const map = (arr: typeof blog, base: string, kind: string) =>
    arr.map((e) => ({
      title: e.data.title || fmt(e.data.pubDate),
      description: e.data.description ?? '',
      tags: e.data.tags,
      url: `${base}/${e.id}`,
      kind,
      date: fmt(e.data.pubDate),
      ts: +e.data.pubDate,
      coming: !!e.data.coming,
      text: e.data.coming ? '' : toText(e.body), // у анонсов текста нет
    }));

  const items = [
    ...map(blog, '/blog', 'Статья'),
    ...map(notes, '/notes', 'Заметка'),
    ...map(diary, '/diary', 'Дневник'),
  ].sort((a, b) => b.ts - a.ts);

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
