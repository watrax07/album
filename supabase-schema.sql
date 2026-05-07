create table if not exists public.user_stickers (
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker_code text not null,
  owned boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, sticker_code)
);

alter table public.user_stickers enable row level security;

drop policy if exists "Users can read their stickers" on public.user_stickers;
create policy "Users can read their stickers"
on public.user_stickers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their stickers" on public.user_stickers;
create policy "Users can add their stickers"
on public.user_stickers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their stickers" on public.user_stickers;
create policy "Users can update their stickers"
on public.user_stickers
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their stickers" on public.user_stickers;
create policy "Users can delete their stickers"
on public.user_stickers
for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.user_repeated_stickers (
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker_code text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, sticker_code)
);

alter table public.user_repeated_stickers enable row level security;

drop policy if exists "Users can read their repeated stickers" on public.user_repeated_stickers;
create policy "Users can read their repeated stickers"
on public.user_repeated_stickers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their repeated stickers" on public.user_repeated_stickers;
create policy "Users can add their repeated stickers"
on public.user_repeated_stickers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their repeated stickers" on public.user_repeated_stickers;
create policy "Users can update their repeated stickers"
on public.user_repeated_stickers
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their repeated stickers" on public.user_repeated_stickers;
create policy "Users can delete their repeated stickers"
on public.user_repeated_stickers
for delete
to authenticated
using ((select auth.uid()) = user_id);
