create policy "coleccion_anon_select"
on public."Coleccion_Salvatierrez"
for select
to anon
using (true);

create policy "tmdb_movies_anon_select"
on public.tmdb_movies
for select
to anon
using (true);

create policy "tmdb_directors_anon_select"
on public.tmdb_directors
for select
to anon
using (true);

create policy "tmdb_movie_directors_anon_select"
on public.tmdb_movie_directors
for select
to anon
using (true);
