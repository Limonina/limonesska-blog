// @ts-check
import { defineConfig, envField } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
// Адаптер Vercel: страницы по-прежнему статика (prerender по умолчанию),
// серверными становятся только ручки с `export const prerender = false`
// (см. src/pages/api/* — лайки через Supabase).
export default defineConfig({
  site: 'https://limonesska.ru',
  adapter: vercel(),
  markdown: {
    // двойная тема подсветки кода: светлая по умолчанию (инлайн),
    // тёмная — через CSS-переменные (--shiki-dark*), переключается по data-theme
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    },
  },
  integrations: [
    mdx(),
    // sitemap: исключаем служебное (og-картинки, лендинг-заглушку, api)
    sitemap({ filter: (page) => !page.includes('/og/') && !page.includes('/plug') && !page.includes('/api/') }),
  ],
  // Секреты Supabase: читаются и в dev (из .env), и в рантайме на Vercel.
  // optional — чтобы сборка/дев работали до того, как ключи прописаны.
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_SERVICE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
