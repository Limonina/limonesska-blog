---
name: new-post
description: Create a new MDX blog post in src/content/blog/ with correct frontmatter. Usage: /new-post <slug> "<title>"
disable-model-invocation: false
---

Create a new blog post at `src/content/blog/$ARGUMENTS.mdx` (derive the slug from the first argument, title from the rest, or ask if not provided).

Steps:
1. Parse $ARGUMENTS: first word = slug (kebab-case), remaining words = title. If only a title-like phrase is given, derive the slug from it.
2. Ask for tags if not obvious from the title (suggest 2–3 relevant ones from existing post tags: разработка, инди, мышление, код, обучение, ошибки, интернет, настройка, победа).
3. Use today's date for `pubDate`.
4. Create the file with this frontmatter and a one-sentence placeholder body:

```mdx
---
title: "<title>"
pubDate: <YYYY-MM-DD>
tags: ["<tag1>", "<tag2>"]
---
<placeholder first sentence>
```

5. Confirm the file path and open it for editing.
