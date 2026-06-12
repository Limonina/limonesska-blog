-- Настройка Supabase для глобальных лайков.
-- Выполни этот скрипт один раз: Supabase → SQL Editor → New query → вставь всё → Run.

-- 1. Таблица-счётчик: одна строка на запись (slug = путь, напр. /blog/my-haos)
create table if not exists likes (
  slug  text primary key,
  count integer not null default 0
);

-- 1a. Защита на уровне строк (RLS). Включаем БЕЗ политик: публичные роли
--     (anon/authenticated) к таблице не допускаются вовсе, а наш сервер ходит
--     с ключом service_role, который RLS обходит — поэтому лайки работают.
alter table likes enable row level security;

-- 2. Атомарный инкремент/декремент счётчика (не опускается ниже 0).
--    Сайт дёргает эту функцию через /api/like (p_delta = 1 лайк, -1 снять).
create or replace function change_like(p_slug text, p_delta int)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into likes (slug, count)
  values (p_slug, greatest(p_delta, 0))
  on conflict (slug)
    do update set count = greatest(likes.count + p_delta, 0)
  returning count into new_count;
  return new_count;
end;
$$;
