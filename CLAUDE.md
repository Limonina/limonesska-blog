# CLAUDE.md

## Project

Personal blog / digital garden — **limonesska.ru**. Astro 6, деплой на Vercel. Контент и общение — на русском.

## Рабочие зоны

Каждая папка открывается **отдельной рабочей зоной** (своя `.claude/`, `CLAUDE.md`, журнал) — чтобы не раздувать контекст. **Эта зона — код сайта.** Рядом вложены и в `.gitignore` сайта (на публичный GitHub НЕ уходят):
- `My way/` — приватная личная папка (свой `.git`, ветка `master`, **никогда не пушится**): планы, идеи постов, финансы, материалы, паспорта (`My way/Китай/`). Открывается как своя зона.
- `My way/Projects/` — приложения-проекты (`content_tracker`, `Finance`, `MyInventoryApp`, …); каждое — своя зона, свой `git`, **публичные** (Лиона их коммитит/пушит/делится).

**Приватность:** содержимое `My way/` (особенно финансы, психопрофиль, паспорта) **не копировать** в отслеживаемые файлы сайта — они публичны.

**Для работы с контентом/постами** загляни в `My way/CLAUDE.md` (кто такая Лиона и как с ней общаться, чего НЕ предлагать, визуальный язык, скилл `/идея`) и в ключевые файлы: `My way/Планы/Сводка идей.md` (идеи постов), `My way/Планы/структура-сайта.md` (архитектура блога), `My way/Идеи постов/`. Для чисто-кодовых задач сайта это не нужно. Всё в одном агенте — `/add-dir` не требуется.

## Структура страниц

Все страницы оборачиваются в `src/layouts/BaseLayout.astro` — он держит `<head>` (мета, шрифты, favicon, проп `title`), токены `:root`, базовые стили и рендерит `<Header>` + `<main class="main-content">` (`<slot/>`) + `<Footer>`. Страница в `src/pages/*` отдаёт только свой контент и стили. Шапку/подвал не дублировать — только через `BaseLayout`; `Footer.astro` полноширинный, вынесен из `.main-content`.

Компоненты: `Header.astro` (шапка + выпадающее меню), `Footer.astro`, `Icon.astro` (инлайн SVG с hover-анимацией).

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
draft: true   # черновик: виден в dev, не попадает на сайт при сборке (опц.)
---
```

**Черновики:** поле `draft: true` (для постов и заметок) скрывает запись из продакшен-сборки (`npm run build` → Vercel), но в `npm run dev` она видна. Логика — в `src/utils/content.ts` (`getEntries`, фильтрует по `import.meta.env.DEV`); все страницы тянут коллекции через него, а не напрямую через `getCollection`.

File naming: kebab-case slug, e.g. `my-post-title.mdx`.

**Коллекции** (объявлены в `src/content.config.ts`, общий loader `glob` и общая схема `entrySchema` с полями `title`, `pubDate`, `tags`, опц. `description`/`cover`/`stage`):
- `blog` — статьи (`src/content/blog/`), маршруты `/blog` и `/blog/[slug]`.
- `notes` — заметки (`src/content/notes/`), маршруты `/notes` и `/notes/[slug]`. **Заметки ≠ посты блога** — это отдельный раздел (короткие мысли), см. `структура-сайта.md`.

Оба раздела рендерятся через `src/layouts/PostLayout.astro` (оборачивает контент в `.prose` — типографика `##`/абзацев/цитат/кода задаётся там глобально). У PostLayout есть пропсы `backHref`/`backLabel` для ссылки «назад». Время чтения считается автоматически из числа слов. Markdown-заголовок верхнего уровня (`#`) в теле не нужен — `title` из frontmatter выводится как `h1`.

**Главная** (`src/pages/index.astro`) тянет данные автоматически: «Новые статьи» ← `getCollection('blog')` через `src/components/PostCard.astro`, «Свежие заметки» ← `getCollection('notes')`. Поле `cover` (URL картинки) используется в `PostCard`.

### Шаблон поста (PostLayout) — авторский формат

Frontmatter (все поля кроме `title`/`pubDate`/`tags` опциональны): `description`, `updatedDate`, `cover`, `category` (рубрика), `subcategory` (подрубрика), `stage` (`base`/`advanced`/`max` → иконка звезды), `audience` (блок «Предполагаемая аудитория»). Для **заметки** поле `post: "<slug-поста>"` привязывает её к посту — она появится в блоке «Заметки к этому посту» внизу той статьи.

Спецэлементы пишутся прямо в теле как HTML (буквица, содержание/TOC из `##`/`###`, нумерация сносок, подсветка активного пункта навешиваются автоматически в `PostLayout`). Типы ссылок задаются через `data-link-type`: `external` (акцент + линия, карточка с URL), `annotated` (карточка с аннотацией: `data-title`/`data-author`/`data-year`/`data-annotation`), `internal` (зелёная, на свой пост: `data-title`/`data-desc`), `quote` (карточка с выдержкой: `data-quote`/`data-source`). Сноска — `<sup data-note="...">+</sup>` (зелёный номер на правом поле). Списки (`-`) автоматически получают маркер `item.svg`. Карточки всплывают сверху слова с треугольничком.

**Точные атрибуты и разметку всех спецэлементов смотреть в демо-посте** `src/content/blog/ritualy-cifrovogo-sada.mdx` (содержит каждый тип).

**Страницы-фильтры** (агрегируют посты + заметки): `/tags/<тег>`, `/category/<рубрика>`, `/subcategory/<подрубрика>` — на них ведут кликабельные теги и рубрика/подрубрика в шапке поста. Общий список рендерит `src/components/EntryList.astro`.

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

**Color palette — 8 канонических токенов** (в `:root`; светлая тема по умолчанию):
- `--bg` / `--card-bg` — фон страницы / карточек
- `--text` / `--text-muted` — текст / приглушённый (даты, мета); ещё тоньше — `--color-text-soft`/`--color-text-faint`
- `--accent` — акцент 1 (рыжий): ссылки, теги, рубрика, действия, hover
- `--accent-2` — акцент 2 (зелёный): иконки, звёзды, маркеры списков, внутр. ссылки/цитаты/сноски (`--color-link` = `--accent-2`)
- `--line` — границы/разделители · `--shadow` — тени

Старые `--color-*` имена — алиасы на эти токены (можно использовать любые).

**Тёмная тема:** значения переопределяются в `html[data-theme="dark"]` (там же, в `BaseLayout`). Переключатель (солнце/луна) в шапке, выбор в `localStorage`, применяется до отрисовки (анти-FOUC inline-скрипт), плавный переход через класс `theme-anim`. Новый цвет добавлять только как тему-зависимый токен (значение в обеих темах), не сырой hex.

Always use tokens — no raw hex colors or px font-sizes in UI. (Чёрные CTA-кнопки — не отдельный цвет, а инверсия: `background: var(--text); color: var(--card-bg)`.)

## Assets

- SVG assets: `src/assets/` (через `import` + `<Image>`) — для всего кроме анимированных иконок
- UI-иконки меню: `src/assets/icons/` — имена файлов могут быть кириллическими
- SVG-иконки с hover-анимацией вшиваются инлайново (`<svg>…</svg>` прямо в шаблон), а не через `<Image>`. При обновлении SVG-файлов инлайн в `.astro` нужно обновлять вручную.
- Иконки меню, звёзды стадий и маркеры списков используют `currentColor` (item.svg — через CSS `mask`), цвет `--accent-2` → следуют теме; не хардкодить `fill`. Логотип — два файла (`limonesska_logo_white_theme.svg` / `..._dark_theme.svg`), свап по теме через CSS.
- Favicon/public files: `public/`
- Import images via `import` + `<Image>` component, not raw `<img src>`

## Interactivity

Vanilla JS помещается в `<script>` блоки внутри `.astro` файлов. Никаких внешних модулей и JS-фреймворков — только прямые DOM-вызовы.

## Deployment

Vercel. No CI config — deploys on push to `main`.

## Бортовой журнал (CHANGELOG.md)

Локальный лог работы в формате *дата · время · запрос · recap* (в `.gitignore`, UTF-8). **Новые записи сверху** — сразу под заголовком сегодняшней даты `## ГГГГ-ММ-ДД`. Один скрипт `.claude/hooks/changelog-log.ps1` обслуживает оба хука (`UserPromptSubmit` и `PostToolUse`/`AskUserQuestion`, подключены в `settings.json`): на запрос пишет `### ЧЧ:ММ — «текст» / _(recap…)_`, на уточнение — отдельный блок `❓ уточнение` с `**В:**`/`**О:**`. Полное описание схемы — `README-changelog.md`. **Хуки вручную не дублировать.**

**Recap пишет Claude.** Сразу после выполнения задачи замени плейсхолдер `_(recap…)_` в верхней записи на выжимку «что сделано» (ключевые файлы/решения, хеш коммита если коммитил), сохранив стиль `_(recap: …)_`. Если несколько коротких сообщений сложились в одну задачу — recap к верхней их записи. Тривиальные запросы можно оставлять с плейсхолдером. Строку запроса `### ЧЧ:ММ — «…»` не редактируй.
