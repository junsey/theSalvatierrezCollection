create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create table if not exists public."Coleccion_Salvatierrez" (
  id uuid primary key default gen_random_uuid(),
  "Seccion" text not null,
  "Año" smallint,
  "Saga" text,
  "Titulo" text not null,
  "Titulo Original" text,
  "Genero" text,
  "Director" text,
  "DirectorTMDbId" integer,
  "Grupo" text,
  "Vista" boolean default false,
  "Doblaje" boolean default false,
  "Formato" text,
  "Puntuacion Rodrigo" numeric(3,1),
  "Puntuacion Gloria" numeric(3,1),
  "Serie" boolean default false,
  "Temporada" smallint,
  "Funciona" boolean default true,
  "En depósito" boolean default false
);

create index if not exists coleccion_salvatierrez_seccion_idx
on public."Coleccion_Salvatierrez" ("Seccion");

create index if not exists coleccion_salvatierrez_ano_idx
on public."Coleccion_Salvatierrez" ("Año");

create index if not exists coleccion_salvatierrez_saga_idx
on public."Coleccion_Salvatierrez" ("Saga");

create index if not exists coleccion_salvatierrez_titulo_idx
on public."Coleccion_Salvatierrez" ("Titulo");

create index if not exists coleccion_salvatierrez_director_tmdb_idx
on public."Coleccion_Salvatierrez" ("DirectorTMDbId");

alter table public."Coleccion_Salvatierrez" enable row level security;

create policy "coleccion_admin_select"
on public."Coleccion_Salvatierrez"
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

create policy "coleccion_admin_insert"
on public."Coleccion_Salvatierrez"
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

create policy "coleccion_admin_update"
on public."Coleccion_Salvatierrez"
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

create policy "coleccion_admin_delete"
on public."Coleccion_Salvatierrez"
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
