create table if not exists public.tmdb_movies (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public."Coleccion_Salvatierrez"(id) on delete cascade,
  tmdb_id integer unique,
  tmdb_title text,
  tmdb_original_title text,
  tmdb_year smallint,
  tmdb_rating numeric(3,1),
  tmdb_genres text[],
  poster_path text,
  plot text,
  raw_json jsonb,
  last_synced_at timestamptz not null default now(),
  source text default 'tmdb',
  unique (collection_id)
);

create index if not exists tmdb_movies_tmdb_id_idx
on public.tmdb_movies (tmdb_id);

create table if not exists public.tmdb_directors (
  id uuid primary key default gen_random_uuid(),
  tmdb_person_id integer unique,
  name text not null,
  profile_path text,
  raw_json jsonb,
  last_synced_at timestamptz not null default now()
);

create index if not exists tmdb_directors_name_idx
on public.tmdb_directors (name);

create table if not exists public.tmdb_movie_directors (
  movie_id uuid not null references public.tmdb_movies(id) on delete cascade,
  director_id uuid not null references public.tmdb_directors(id) on delete cascade,
  job text default 'Director',
  primary key (movie_id, director_id)
);

create index if not exists tmdb_movie_directors_director_idx
on public.tmdb_movie_directors (director_id);

alter table public.tmdb_movies enable row level security;
alter table public.tmdb_directors enable row level security;
alter table public.tmdb_movie_directors enable row level security;

create policy "tmdb_movies_admin_select"
on public.tmdb_movies
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

create policy "tmdb_movies_admin_insert"
on public.tmdb_movies
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

create policy "tmdb_movies_admin_update"
on public.tmdb_movies
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

create policy "tmdb_movies_admin_delete"
on public.tmdb_movies
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

create policy "tmdb_directors_admin_select"
on public.tmdb_directors
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

create policy "tmdb_directors_admin_insert"
on public.tmdb_directors
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

create policy "tmdb_directors_admin_update"
on public.tmdb_directors
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

create policy "tmdb_directors_admin_delete"
on public.tmdb_directors
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

create policy "tmdb_movie_directors_admin_select"
on public.tmdb_movie_directors
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

create policy "tmdb_movie_directors_admin_insert"
on public.tmdb_movie_directors
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

create policy "tmdb_movie_directors_admin_update"
on public.tmdb_movie_directors
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

create policy "tmdb_movie_directors_admin_delete"
on public.tmdb_movie_directors
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
