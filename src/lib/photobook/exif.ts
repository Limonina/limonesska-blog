/**
 * Дата съёмки из EXIF (тег DateTimeOriginal) — чтобы фото само встало в свой день.
 * Читаем только начало файла: заголовок APP1 + TIFF-каталог.
 */

const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;

export async function readShotDate(file: File): Promise<Date | null> {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(head);
    if (v.getUint16(0) !== 0xffd8) return null; // не JPEG

    let off = 2;
    while (off + 4 < v.byteLength) {
      if (v.getUint8(off) !== 0xff) break;
      const marker = v.getUint8(off + 1);
      const size = v.getUint16(off + 2);
      if (marker === 0xe1) {
        const start = off + 4;
        // 'Exif\0\0'
        if (v.getUint32(start) === 0x45786966) return parseTiff(v, start + 6);
        return null;
      }
      if (marker === 0xda) break; // пошли данные картинки
      off += 2 + size;
    }
  } catch {
    /* пусто — просто нет даты */
  }
  return null;
}

function parseTiff(v: DataView, base: number): Date | null {
  const le = v.getUint16(base) === 0x4949;
  const u16 = (p: number) => v.getUint16(p, le);
  const u32 = (p: number) => v.getUint32(p, le);
  if (u16(base + 2) !== 42) return null;

  const readIfd = (ifd: number, want: number[]): Map<number, number> => {
    const found = new Map<number, number>();
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      const tag = u16(e);
      if (want.includes(tag)) found.set(tag, e);
    }
    return found;
  };

  const str = (entry: number): string => {
    const count = u32(entry + 4);
    const valOff = count > 4 ? base + u32(entry + 8) : entry + 8;
    let s = '';
    for (let i = 0; i < count - 1; i++) s += String.fromCharCode(v.getUint8(valOff + i));
    return s;
  };

  const ifd0 = base + u32(base + 4);
  const e0 = readIfd(ifd0, [TAG_EXIF_IFD, TAG_DATETIME]);

  const exifPtr = e0.get(TAG_EXIF_IFD);
  if (exifPtr) {
    const sub = base + u32(exifPtr + 8);
    const e1 = readIfd(sub, [TAG_DATETIME_ORIGINAL]);
    const dto = e1.get(TAG_DATETIME_ORIGINAL);
    if (dto) return parseExifDate(str(dto));
  }
  const dt = e0.get(TAG_DATETIME);
  return dt ? parseExifDate(str(dt)) : null;
}

/** «2026:07:19 08:14:22» → Date */
function parseExifDate(s: string): Date | null {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m.map(Number) as unknown as number[];
  const date = new Date(y, mo - 1, d, h, mi, sec);
  return isNaN(date.getTime()) ? null : date;
}
