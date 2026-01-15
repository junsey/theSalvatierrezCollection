#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const YEAR_KEYS = ['AA\u00f1o', 'A\u00f1o', 'Ano'];
const ORIGINAL_TITLE_KEY = 'Titulo Original';

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function parseArgs() {
  const args = new Map();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.slice(2).split('=');
    args.set(key, value ?? 'true');
  }
  return args;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseYear(value) {
  if (!value) return null;
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function roundRating(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 10) / 10;
}

const envFromFile = loadDotEnv();
const args = parseArgs();

const SUPABASE_URL = process.env.SUPABASE_URL ?? envFromFile.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromFile.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_API_KEY =
  process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY ?? envFromFile.TMDB_API_KEY ?? envFromFile.VITE_TMDB_API_KEY;
const TMDB_BEARER =
  process.env.TMDB_BEARER ?? process.env.VITE_TMDB_BEARER ?? envFromFile.TMDB_BEARER ?? envFromFile.VITE_TMDB_BEARER;

const DRY_RUN = args.get('dry-run') === 'true';
const LIMIT = toNumber(args.get('limit'), null);
const BATCH_SIZE = toNumber(args.get('batch-size'), 200);
const MAX_RPS = Math.max(1, toNumber(args.get('max-rps'), 4));
const SINCE_DAYS = Math.max(1, toNumber(args.get('since-days'), 30));
const FORCE = args.get('force') === 'true';
const ONLY_MISSING = args.get('only-missing') === 'true';
const COLLECTION_ID = args.get('collection-id') ?? null;
const OVERRIDE_TMDB_ID = args.has('tmdb-id') ? toNumber(args.get('tmdb-id'), null) : null;
const SYNC_DIRECTORS = args.get('sync-directors') === 'true';
const DIRECTORS_LIMIT = toNumber(args.get('directors-limit'), null);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!TMDB_API_KEY || !TMDB_BEARER) {
  console.error('Missing TMDB_API_KEY/VITE_TMDB_API_KEY or TMDB_BEARER/VITE_TMDB_BEARER.');
  process.exit(1);
}

const restBaseUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const tmdbBaseUrl = 'https://api.themoviedb.org/3';
const sinceMs = SINCE_DAYS * 24 * 60 * 60 * 1000;
const minDelayMs = Math.ceil(1000 / MAX_RPS);
const processedDirectorIds = new Set();

async function supabaseRequest(pathname, options = {}) {
  const url = `${restBaseUrl}/${pathname}`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function tmdbRequest(pathname, params = {}) {
  const url = new URL(`${tmdbBaseUrl}/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('api_key', TMDB_API_KEY);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_BEARER}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDb error ${response.status}: ${text}`);
  }

  return response.json();
}

function getYearValue(record) {
  for (const key of YEAR_KEYS) {
    if (record[key] !== undefined) return record[key];
  }
  return null;
}

async function fetchCollectionBatch(offset, limit) {
  const params = new URLSearchParams({
    select: '*',
    order: 'id',
    limit: String(limit),
    offset: String(offset),
  });
  return supabaseRequest(`Coleccion_Salvatierrez?${params.toString()}`);
}

async function fetchCollectionById(id) {
  const params = new URLSearchParams({ select: '*' });
  params.set('id', `eq.${id}`);
  const rows = await supabaseRequest(`Coleccion_Salvatierrez?${params.toString()}`);
  return rows?.[0] ?? null;
}

async function fetchDirectorBatch(offset, limit) {
  const params = new URLSearchParams({
    select: 'tmdb_person_id',
    order: 'tmdb_person_id',
    limit: String(limit),
    offset: String(offset),
  });
  return supabaseRequest(`tmdb_directors?${params.toString()}`);
}

async function fetchExistingTmdbRows(collectionIds) {
  if (collectionIds.length === 0) return new Map();
  const params = new URLSearchParams({
    select: 'id,collection_id,tmdb_id,last_synced_at,source',
  });
  params.set('collection_id', `in.(${collectionIds.join(',')})`);
  const rows = await supabaseRequest(`tmdb_movies?${params.toString()}`);
  const map = new Map();
  for (const row of rows ?? []) {
    map.set(row.collection_id, row);
  }
  return map;
}

async function upsertTmdbMovie(payload) {
  if (DRY_RUN) {
    console.log('[dry-run] tmdb_movies upsert', payload.collection_id, payload.tmdb_id);
    return { id: 'dry-run' };
  }
  const params = new URLSearchParams({ on_conflict: 'collection_id' });
  const headers = { Prefer: 'resolution=merge-duplicates,return=representation' };
  const result = await supabaseRequest(`tmdb_movies?${params.toString()}`, {
    method: 'POST',
    headers,
    body: payload,
  });
  return result?.[0];
}

async function upsertTmdbDirector(payload) {
  if (DRY_RUN) {
    console.log('[dry-run] tmdb_directors upsert', payload.tmdb_person_id, payload.name);
    return { id: 'dry-run' };
  }
  const params = new URLSearchParams({ on_conflict: 'tmdb_person_id' });
  const headers = { Prefer: 'resolution=merge-duplicates,return=representation' };
  const result = await supabaseRequest(`tmdb_directors?${params.toString()}`, {
    method: 'POST',
    headers,
    body: payload,
  });
  return result?.[0];
}

async function upsertMovieDirector(payload) {
  if (DRY_RUN) {
    console.log('[dry-run] tmdb_movie_directors link', payload.movie_id, payload.director_id);
    return;
  }
  const params = new URLSearchParams({ on_conflict: 'movie_id,director_id' });
  const headers = { Prefer: 'resolution=ignore-duplicates' };
  await supabaseRequest(`tmdb_movie_directors?${params.toString()}`, {
    method: 'POST',
    headers,
    body: payload,
  });
}

async function upsertDirectorFilmography(entries) {
  if (entries.length === 0) return;
  if (DRY_RUN) {
    console.log('[dry-run] tmdb_director_filmography upsert', entries[0]?.tmdb_person_id, entries.length);
    return;
  }
  const params = new URLSearchParams({ on_conflict: 'tmdb_person_id,tmdb_movie_id' });
  const headers = { Prefer: 'resolution=merge-duplicates,return=minimal' };
  await supabaseRequest(`tmdb_director_filmography?${params.toString()}`, {
    method: 'POST',
    headers,
    body: entries,
  });
}

async function searchMovie(title, year) {
  const data = await tmdbRequest('search/movie', {
    query: title,
    year: year ?? undefined,
    language: 'es-ES',
    include_adult: false,
  });
  return data?.results?.[0] ?? null;
}

async function fetchMovieDetails(tmdbId) {
  return tmdbRequest(`movie/${tmdbId}`, { language: 'es-ES' });
}

async function fetchMovieCredits(tmdbId) {
  return tmdbRequest(`movie/${tmdbId}/credits`, { language: 'es-ES' });
}

async function fetchPersonMovieCredits(personId) {
  return tmdbRequest(`person/${personId}/movie_credits`, { language: 'es-ES' });
}

async function syncDirectorFilmography(personId) {
  if (!personId || processedDirectorIds.has(personId)) return;
  processedDirectorIds.add(personId);
  const credits = await fetchPersonMovieCredits(personId);
  const directed = (credits?.crew ?? [])
    .filter((item) => item.job === 'Director')
    .map((item) => ({
      tmdb_person_id: personId,
      tmdb_movie_id: item.id,
      title: item.title ?? 'Sin titulo',
      year: parseYear(item.release_date),
      poster_path: item.poster_path ?? null,
      last_synced_at: new Date().toISOString(),
    }))
    .filter((item) => item.tmdb_movie_id);
  await upsertDirectorFilmography(directed);
}

async function processMovie(record, existing, overrideTmdbId) {
  const title = record.Titulo?.trim();
  if (!title) return { status: 'skipped', reason: 'missing-title' };

  if (existing && !FORCE && !overrideTmdbId) {
    const syncedAt = existing.last_synced_at ? Date.parse(existing.last_synced_at) : null;
    if (ONLY_MISSING) return { status: 'skipped', reason: 'exists' };
    if (syncedAt && Date.now() - syncedAt < sinceMs) {
      return { status: 'skipped', reason: 'fresh' };
    }
  }

  const year = getYearValue(record);
  let match = null;
  if (!overrideTmdbId) {
    match = await searchMovie(title, year);
    if (!match && record[ORIGINAL_TITLE_KEY]) {
      match = await searchMovie(String(record[ORIGINAL_TITLE_KEY]).trim(), year);
    }
  }

  if (!match && !overrideTmdbId) {
    const payload = {
      collection_id: record.id,
      tmdb_id: null,
      tmdb_title: null,
      tmdb_original_title: null,
      tmdb_year: year ? parseYear(year) : null,
      tmdb_rating: null,
      tmdb_genres: [],
      poster_path: null,
      plot: null,
      raw_json: {
        status: 'not-found',
        titles: [title, record[ORIGINAL_TITLE_KEY]].filter(Boolean),
        year: year ?? null,
      },
      last_synced_at: new Date().toISOString(),
      source: 'not-found',
    };
    await upsertTmdbMovie(payload);
    return { status: 'not-found' };
  }

  const targetId = overrideTmdbId ?? match.id;
  const details = await fetchMovieDetails(targetId);
  const credits = await fetchMovieCredits(targetId);

  const payload = {
    collection_id: record.id,
    tmdb_id: details?.id ?? targetId,
    tmdb_title: details?.title ?? match?.title ?? null,
    tmdb_original_title: details?.original_title ?? match?.original_title ?? null,
    tmdb_year: parseYear(details?.release_date ?? match?.release_date),
    tmdb_rating: roundRating(details?.vote_average ?? match?.vote_average),
    tmdb_genres: (details?.genres ?? []).map((genre) => genre.name).filter(Boolean),
    poster_path: details?.poster_path ?? match?.poster_path ?? null,
    plot: details?.overview ?? null,
    raw_json: details,
    last_synced_at: new Date().toISOString(),
    source: overrideTmdbId ? 'override' : 'tmdb',
  };

  const movieRow = await upsertTmdbMovie(payload);
  const directors = (credits?.crew ?? []).filter((person) => person.job === 'Director');

  for (const director of directors) {
    const directorPayload = {
      tmdb_person_id: director.id,
      name: director.name ?? 'Unknown',
      profile_path: director.profile_path ?? null,
      raw_json: director,
      last_synced_at: new Date().toISOString(),
    };
    const directorRow = await upsertTmdbDirector(directorPayload);
    await upsertMovieDirector({
      movie_id: movieRow?.id,
      director_id: directorRow?.id,
      job: director.job ?? 'Director',
    });
    await syncDirectorFilmography(director.id);
  }

  return { status: 'synced', tmdb_id: payload.tmdb_id, directors: directors.length };
}

async function run() {
  console.log('Starting TMDb sync...');
  if (COLLECTION_ID) {
    const record = await fetchCollectionById(COLLECTION_ID);
    if (!record) {
      console.log('No collection record found for id', COLLECTION_ID);
      return;
    }
    const existingMap = await fetchExistingTmdbRows([record.id]);
    await processMovie(record, existingMap.get(record.id), OVERRIDE_TMDB_ID);
    console.log('Done. processed=1');
    return;
  }
  if (SYNC_DIRECTORS) {
    console.log('Syncing director filmography...');
    let offset = 0;
    let processed = 0;
    const limit = DIRECTORS_LIMIT ?? Number.MAX_SAFE_INTEGER;
    while (processed < limit) {
      const batchLimit = Math.min(BATCH_SIZE, limit - processed);
      const directors = await fetchDirectorBatch(offset, batchLimit);
      if (!directors || directors.length === 0) break;
      for (const row of directors) {
        if (!row.tmdb_person_id) continue;
        await syncDirectorFilmography(row.tmdb_person_id);
        processed += 1;
        if (processed >= limit) break;
        await sleep(minDelayMs);
      }
      offset += directors.length;
      console.log(`Directors processed: ${processed}`);
    }
    console.log(`Director filmography sync done. processed=${processed}`);
    return;
  }
  let offset = 0;
  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let notFound = 0;
  const limit = LIMIT ?? Number.MAX_SAFE_INTEGER;

  while (processed < limit) {
    const batchLimit = Math.min(BATCH_SIZE, limit - processed);
    const records = await fetchCollectionBatch(offset, batchLimit);
    if (!records || records.length === 0) break;

    const ids = records.map((record) => record.id);
    const existingMap = await fetchExistingTmdbRows(ids);

    for (const record of records) {
      const existing = existingMap.get(record.id);
      const result = await processMovie(record, existing, null);
      processed += 1;

      if (result.status === 'synced') synced += 1;
      else if (result.status === 'not-found') notFound += 1;
      else skipped += 1;

      if (processed >= limit) break;
      await sleep(minDelayMs);
    }

    offset += records.length;
    console.log(`Progress: processed=${processed} synced=${synced} not_found=${notFound} skipped=${skipped}`);
  }

  console.log(`Done. processed=${processed} synced=${synced} not_found=${notFound} skipped=${skipped}`);
}

run().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
