import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Общая схема для постов блога и заметок
const entrySchema = z.object({
  title: z.string(),
  pubDate: z.date(),
  updatedDate: z.date().optional(),
  tags: z.array(z.string()),
  description: z.string().optional(),
  cover: z.string().optional(),
  // Стадия готовности (звезда): base → набросок, advanced → в процессе, max → готово
  stage: z.enum(['base', 'advanced', 'max']).optional(),
  // Метаинфо в шапке поста
  category: z.string().optional(), // рубрика, напр. "Мышление"
  subcategory: z.string().optional(), // подрубрика, напр. "Эзотерика"
  audience: z.string().optional(), // блок «Предполагаемая аудитория»
  // Для заметок: slug родительского поста (блок «Заметки к этому посту»)
  post: z.string().optional(),
  // Для дневника: фото дня (первое — главное в календарной ячейке)
  photos: z.array(z.string()).optional(),
  // Черновик: виден в dev, но не попадает в продакшен-сборку (на сайт)
  draft: z.boolean().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: entrySchema,
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: entrySchema,
});

// Дневник — личные записи по дням (memory). Тот же шаблон, что у постов (PostLayout),
// но отдельная коллекция: в календарь /diary тянутся ТОЛЬКО дневниковые записи.
// title необязателен: бывают «фото-только» дни (одно фото, без текста-записи).
const diary = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/diary' }),
  schema: entrySchema.extend({ title: z.string().optional() }),
});

export const collections = { blog, notes, diary };
