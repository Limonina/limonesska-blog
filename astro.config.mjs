// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
// Полностью статический сайт (деплой на GitHub Pages через Actions).
// Серверных ручек нет — всё пекётся на сборке (OG-картинки, sitemap, search.json).
export default defineConfig({
  site: 'https://limonesska.ru',
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
    sitemap({ filter: (page) => !page.includes('/og/') && !page.includes('/plug') }),
  ],
});
