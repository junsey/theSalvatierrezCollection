create table if not exists public.tmdb_director_filmography (
  id uuid primary key default gen_random_uuid(),
  tmdb_person_id integer not null,
  tmdb_movie_id integer not null,
  title text not null,
  year smallint,
  is_visible boolean not null default true,
  last_synced_at timestamptz not null default now(),
  unique (tmdb_person_id, tmdb_movie_id)
);

create index if not exists tmdb_director_filmography_person_idx
on public.tmdb_director_filmography (tmdb_person_id);

create index if not exists tmdb_director_filmography_movie_idx
on public.tmdb_director_filmography (tmdb_movie_id);

alter table public.tmdb_director_filmography enable row level security;

create policy "tmdb_director_filmography_admin_select"
on public.tmdb_director_filmography
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin
      and p.is_approved
  )
);

create policy "tmdb_director_filmography_admin_insert"
on public.tmdb_director_filmography
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin
      and p.is_approved
  )
);

create policy "tmdb_director_filmography_admin_update"
on public.tmdb_director_filmography
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin
      and p.is_approved
  )
);

create policy "tmdb_director_filmography_admin_delete"
on public.tmdb_director_filmography
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin
      and p.is_approved
  )
);

create policy "tmdb_director_filmography_anon_select"
on public.tmdb_director_filmography
for select
to anon
using (true);
