create table if not exists public.director_favorites (
  director_key text primary key,
  director_name text,
  tmdb_person_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_favorites_tmdb_person_id_idx
on public.director_favorites (tmdb_person_id);

alter table public.director_favorites enable row level security;

create policy "director_favorites_anon_select"
on public.director_favorites
for select
to anon
using (true);

create policy "director_favorites_anon_insert"
on public.director_favorites
for insert
to anon
with check (true);

create policy "director_favorites_anon_update"
on public.director_favorites
for update
to anon
using (true)
with check (true);

create policy "director_favorites_anon_delete"
on public.director_favorites
for delete
to anon
using (true);

create policy "director_favorites_authenticated_all"
on public.director_favorites
for all
to authenticated
using (true)
with check (true);
