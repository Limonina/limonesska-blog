// Заливка фото дневника в Cloudinary.
//
// Как пользоваться:
//   1. Положить ключ Cloudinary в .env — строка CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
//   2. Кинуть фото в папку photos-upload/ (она в .gitignore, в репо не уедет).
//   3. Запустить:  npm run upload-photos
//   4. Скрипт зальёт всё в Cloudinary (папка "diary") и выведет готовый блок
//      photos: с URL — скопировать в нужную запись src/content/diary/*.mdx.
//
// После заливки скрипт САМ очищает photos-upload/ (фото уже в Cloudinary),
// чтобы при следующем запуске не залить их повторно.
// Чтобы оставить файлы на месте — запусти с флагом --keep.

import { v2 as cloudinary } from 'cloudinary';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'photos-upload';
const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const EXTS = new Set([...IMG_EXTS, ...VIDEO_EXTS]);
const KEEP = process.argv.includes('--keep');

// SDK сам читает CLOUDINARY_URL из окружения (--env-file=.env)
if (!cloudinary.config().cloud_name) {
  console.error('✖ Не найден CLOUDINARY_URL. Добавь в .env строку CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME');
  process.exit(1);
}

let files;
try {
  files = (await readdir(DIR)).filter((f) => EXTS.has(path.extname(f).toLowerCase()));
} catch {
  console.error(`✖ Нет папки ${DIR}/ — создай её и положи фото.`);
  process.exit(1);
}

if (!files.length) {
  console.log(`Папка ${DIR}/ пуста — нечего заливать.`);
  process.exit(0);
}

console.log(`Заливаю ${files.length} фото в Cloudinary (папка "diary")…\n`);

const urls = [];
const uploaded = []; // имена успешно залитых файлов — их потом удаляем
const failed = [];   // {file, reason} — не залились (тяжёлые/битые), остаются в папке
for (const f of files) {
  try {
    const isVideo = VIDEO_EXTS.has(path.extname(f).toLowerCase());
    const res = await cloudinary.uploader.upload(path.join(DIR, f), {
      folder: 'diary',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      resource_type: isVideo ? 'video' : 'image',
    });
    // Чистый URL — оптимизацию (f_auto,q_auto + размер) навешивает сайт при отрисовке
    const url = res.secure_url;
    urls.push(url);
    uploaded.push(f);
    console.log(`  ✓ ${f}`);
  } catch (e) {
    const reason = e?.message || e?.error?.message || String(e);
    failed.push({ file: f, reason });
    console.error(`  ✖ ${f}: ${reason}`);
  }
}

if (urls.length) {
  console.log('\nГотово. Вставь в нужную запись (src/content/diary/*.mdx):\n');
  console.log('photos:');
  for (const u of urls) console.log(`  - "${u}"`);
}

// Чистим папку ТОЛЬКО от успешно залитых (если не --keep). Незалитые остаются.
if (uploaded.length && !KEEP) {
  await Promise.all(uploaded.map((f) => unlink(path.join(DIR, f)).catch(() => {})));
  console.log(`\n🧹 Очистил ${DIR}/ — удалил ${uploaded.length} залит. файл(ов).`);
} else if (uploaded.length && KEEP) {
  console.log(`\n⚠️  Файлы оставлены (--keep). Не забудь очистить ${DIR}/, иначе зальются повторно.`);
}

// Итог по незалитым — остаются в папке, чтобы можно было сжать и повторить
if (failed.length) {
  console.log(`\n⚠️  Не залилось: ${failed.length} (остались в ${DIR}/):`);
  for (const { file, reason } of failed) console.log(`  • ${file} — ${reason}`);
  console.log('Частые причины: файл > 10 МБ или изображение > 25 МП (free-план).');
  console.log('Сожми/уменьши и запусти снова.');
}
