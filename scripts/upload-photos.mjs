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
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.avif']);
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
for (const f of files) {
  try {
    const res = await cloudinary.uploader.upload(path.join(DIR, f), {
      folder: 'diary',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });
    // f_auto,q_auto — Cloudinary сам отдаст оптимальный формат/качество
    const url = res.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    urls.push(url);
    uploaded.push(f);
    console.log(`  ✓ ${f}`);
  } catch (e) {
    console.error(`  ✖ ${f}: ${e.message}`);
  }
}

if (urls.length) {
  console.log('\nГотово. Вставь в нужную запись (src/content/diary/*.mdx):\n');
  console.log('photos:');
  for (const u of urls) console.log(`  - "${u}"`);
}

// Чистим папку от успешно залитых файлов (если не --keep)
if (uploaded.length && !KEEP) {
  await Promise.all(uploaded.map((f) => unlink(path.join(DIR, f)).catch(() => {})));
  console.log(`\n🧹 Очистил ${DIR}/ — удалил ${uploaded.length} залит. файл(ов). Папка готова к следующей заливке.`);
} else if (uploaded.length && KEEP) {
  console.log(`\n⚠️  Файлы оставлены (--keep). Не забудь очистить ${DIR}/, иначе зальются повторно.`);
}
