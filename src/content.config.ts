import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Общая схема для постов блога и заметок
const entrySchema = z.object({
  title: z.string(),
  pubDate: z.date(),
  tags: z.array(z.string()),
  description: z.string().optional(),
  cover: z.string().optional(),
  // Стадия готовности (звезда): base → набросок, advanced → в процессе, max → готово
  stage: z.enum(['base', 'advanced', 'max']).optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: entrySchema,
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: entrySchema,
});

export const collections = { blog, notes };
