import { getCollection, type CollectionKey } from 'astro:content';

// Обёртка над getCollection: в dev (npm run dev) показываем всё, включая
// черновики (`draft: true`), а в продакшен-сборке (npm run build → GitHub Pages)
// черновики отфильтровываются и на сайт не попадают.
//
// Записи-анонсы (`coming: true`) НЕ прячутся — они видны в списках как тизеры,
// а их собственная страница показывает заглушку «выйдет такого-то» (дата =
// pubDate) вместо текста. См. ComingSoon.astro и slug-страницы.
export async function getEntries(collection: CollectionKey) {
  return getCollection(
    collection,
    ({ data }) => import.meta.env.DEV || !data.draft
  );
}
