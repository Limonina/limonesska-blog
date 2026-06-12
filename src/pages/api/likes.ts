import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from 'astro:env/server';

// Все счётчики разом: { "<slug>": <count>, ... }
// Нужно для ранжирования тем/тегов по лайкам и подписей на карточках.
export const prerender = false;

export const GET: APIRoute = async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    // лёгкое кэширование на CDN, чтобы не дёргать БД на каждый заход
    'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
  };
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response('{}', { headers });
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/likes?select=slug,count`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!r.ok) return new Response('{}', { headers });
  const rows = (await r.json()) as Array<{ slug: string; count: number }>;
  const map: Record<string, number> = {};
  for (const row of rows) map[row.slug] = row.count;
  return new Response(JSON.stringify(map), { headers });
};
