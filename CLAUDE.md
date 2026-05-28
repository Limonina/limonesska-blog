# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal blog / digital garden — **limonesska.ru**. Built with Astro 6, deployed to Vercel. Russian-language content.

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
---
```

File naming: kebab-case slug, e.g. `my-post-title.mdx`.

## Styling

All CSS is written inline inside `.astro` files using `<style is:global>`. No separate CSS files, no Tailwind, no CSS modules. CSS variables are defined in `:root` in `src/pages/index.astro`:

- `--font-display` / `--font-vollkorn` / `--font-ui` — the three allowed fonts
- `--size-mega` / `--size-medium` / `--size-base` / `--size-small` — the four allowed sizes

Stick to these variables when adding UI.

## Assets

- SVG assets: `src/assets/` (processed by Astro's Image component)
- Favicon/public files: `public/`
- Import images via `import` + `<Image>` component, not raw `<img src>`

## Deployment

Vercel. No CI config — deploys on push to `main`.
