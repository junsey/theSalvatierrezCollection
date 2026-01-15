alter table public.tmdb_movies
drop constraint if exists tmdb_movies_tmdb_id_key;

create index if not exists tmdb_movies_tmdb_id_idx
on public.tmdb_movies (tmdb_id);
