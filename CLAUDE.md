# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal blog / digital garden — **limonesska.ru**. Built with Astro 6, deployed to Vercel. Russian-language content.

## Структура страниц

Все страницы оборачиваются в `src/layouts/BaseLayout.astro` — он держит `<head>` (мета, шрифты, favicon, проп `title`), дизайн-токены `:root`, базовые стили и рендерит `<Header>` + `<main class="main-content">` (`<slot/>`) + `<Footer>`. Страница в `src/pages/*` отдаёт только свой контент и свои стили внутри `<BaseLayout>`.

- `src/components/Header.astro` — шапка с выпадающим меню (разметка + стили + `<script>` дропдауна).
- `src/components/Footer.astro` — подвал.
- `src/components/Icon.astro` — инлайн SVG-иконок с hover-анимацией.

Шапку/подвал НЕ дублировать в страницах — только через `BaseLayout`.

## Commands

```bash
npm run dev      # dev server at http://localhost:4321
npm run build    # build to ./dist/
npm run preview  # preview production build
```

No test or lint setup — none configured.

## Content

Blog posts live in `src/content/blog/` as MDX files. Required frontmatter:

```mdx
---
title: "Заголовок поста"
pubDate: 2026-05-28
tags: ["тег1", "тег2"]
description: "Короткое описание для списка /blog (опционально)"
---
```

File naming: kebab-case slug, e.g. `my-post-title.mdx`.

**Коллекции** (объявлены в `src/content.config.ts`, общий loader `glob` и общая схема `entrySchema` с полями `title`, `pubDate`, `tags`, опц. `description`/`cover`/`stage`):
- `blog` — статьи (`src/content/blog/`), маршруты `/blog` и `/blog/[slug]`.
- `notes` — заметки (`src/content/notes/`), маршруты `/notes` и `/notes/[slug]`. **Заметки ≠ посты блога** — это отдельный раздел (короткие мысли), см. `структура-сайта.md`.

Оба раздела рендерятся через `src/layouts/PostLayout.astro` (оборачивает контент в `.prose` — типографика `##`/абзацев/цитат/кода задаётся там глобально). У PostLayout есть пропсы `backHref`/`backLabel` для ссылки «назад». Время чтения считается автоматически из числа слов. Markdown-заголовок верхнего уровня (`#`) в теле не нужен — `title` из frontmatter выводится как `h1`.

**Главная** (`src/pages/index.astro`) тянет данные автоматически: «Новые статьи» ← `getCollection('blog')` через `src/components/PostCard.astro`, «Свежие заметки» ← `getCollection('notes')`. Захардкоженных карточек больше нет. Поле `cover` (URL картинки) используется в `PostCard`.

## Styling

All CSS is written inline inside `.astro` files using `<style is:global>`. No separate CSS files, no Tailwind, no CSS modules. CSS variables (design tokens) are defined in `:root` in `src/layouts/BaseLayout.astro`:

**Fonts (3 allowed):**
- `--font-display` (Playfair Display) — крупные заголовки / hero
- `--font-vollkorn` (Vollkorn) — основной читаемый текст
- `--font-ui` (Manrope) — интерфейс, мета, теги

**Size scale:**
- `--size-mega` — h1 / hero
- `--size-h2` — заголовки секций и постов
- `--size-h3` — подзаголовки
- `--size-medium` — лид-абзац, кнопки
- `--size-base` — основной текст (1rem)
- `--size-small` — мета, теги (0.75rem)

(Базовый `font-size` на `body` — 17px, как было исходно.)

**Color palette:**
- `--color-bg` / `--color-surface` — фон страницы / карточек
- `--color-text` / `--color-text-soft` / `--color-text-muted` / `--color-text-faint` — текст по убыванию контраста
- `--color-accent` — акцент (#FF5C00, hover/ссылки)
- `--color-border` / `--color-border-soft` — границы

Always use these tokens — no raw hex colors or px font-sizes in UI. (Pure-black CTA buttons `#000`/`#333` остаются как отдельный компонентный случай.)

## Assets

- SVG assets: `src/assets/` (через `import` + `<Image>`) — для всего кроме анимированных иконок
- UI-иконки меню: `src/assets/icons/` — имена файлов могут быть кириллическими
- SVG-иконки с hover-анимацией вшиваются инлайново (`<svg>…</svg>` прямо в шаблон), а не через `<Image>`. При обновлении SVG-файлов инлайн в `.astro` нужно обновлять вручную.
- Favicon/public files: `public/`
- Import images via `import` + `<Image>` component, not raw `<img src>`

## Interactivity

Vanilla JS помещается в `<script>` блоки внутри `.astro` файлов. Никаких внешних модулей и JS-фреймворков — только прямые DOM-вызовы.

## Deployment

Vercel. No CI config — deploys on push to `main`.
