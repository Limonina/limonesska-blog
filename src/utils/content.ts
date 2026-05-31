import { getCollection, type CollectionKey } from 'astro:content';

// Обёртка над getCollection: в dev (npm run dev) показываем всё, включая
// черновики (`draft: true`), а в продакшен-сборке (npm run build → Vercel)
// черновики отфильтровываются и на сайт не попадают.
export async function getEntries(collection: CollectionKey) {
  return getCollection(
    collection,
    ({ data }) => import.meta.env.DEV || !data.draft
  );
}
