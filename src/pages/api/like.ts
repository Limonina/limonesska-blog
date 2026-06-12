import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from 'astro:env/server';

// Серверная ручка (не статика) — лайки через Supabase.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const sbHeaders = () => ({
  apikey: SUPABASE_SERVICE_KEY!,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY!}`,
  'Content-Type': 'application/json',
});

const configured = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// GET /api/like?slug=...  → { count }
export const GET: APIRoute = async ({ url }) => {
  const slug = (url.searchParams.get('slug') || '').slice(0, 200);
  if (!slug) return json({ error: 'no-slug' }, 400);
  if (!configured()) return json({ count: 0, configured: false });

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/likes?slug=eq.${encodeURIComponent(slug)}&select=count`,
    { headers: sbHeaders() }
  );
  if (!r.ok) return json({ error: 'db', count: 0 }, 502);
  const rows = (await r.json()) as Array<{ count: number }>;
  return json({ count: rows?.[0]?.count ?? 0 });
};

// POST /api/like  { slug, delta: 1 | -1 }  → { count }
export const POST: APIRoute = async ({ request }) => {
  if (!configured()) return json({ error: 'not-configured' }, 503);
  let body: { slug?: string; delta?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-json' }, 400);
  }
  const slug = String(body.slug || '').slice(0, 200);
  const delta = body.delta === -1 ? -1 : 1; // только ±1
  if (!slug) return json({ error: 'no-slug' }, 400);

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/change_like`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ p_slug: slug, p_delta: delta }),
  });
  if (!r.ok) return json({ error: 'db', detail: await r.text() }, 502);
  const count = await r.json(); // функция возвращает integer
  return json({ count: typeof count === 'number' ? count : count?.count ?? 0 });
};
