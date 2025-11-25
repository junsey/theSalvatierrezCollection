import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { buildOwnedTmdbIdSet } from '../services/directors';
import { tmdbFetchJson } from '../services/tmdbApi';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const API_BASE = 'https://api.themoviedb.org/3';

type CombinedCrewCredit = {
  id: number;
  media_type?: 'movie' | 'tv' | string;
  job?: string | null;
  title?: string | null;
  name?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
  vote_count?: number | null;
  popularity?: number | null;
  video?: boolean | null;
};

type MovieDetailsResponse = {
  runtime?: number | null;
};

type CombinedCreditsResponse = {
  crew?: CombinedCrewCredit[];
};

type PersonResponse = {
  id: number;
  name: string;
  biography?: string | null;
  profile_path?: string | null;
};

type FilmographyEntry = {
  id: number;
  title: string;
  year: number | null;
  mediaType: 'movie' | 'tv';
  posterUrl?: string;
  voteCount: number;
  sortDate: number;
};

type FilmographyBuckets = {
  directed: FilmographyEntry[];
  created: FilmographyEntry[];
};

const parseDateValue = (credit: CombinedCrewCredit) =>
  new Date(credit.release_date ?? credit.first_air_date ?? '1900-01-01').getTime();

const mapCredit = (credit: CombinedCrewCredit): FilmographyEntry => {
  const dateValue = parseDateValue(credit);
  const year = (() => {
    const source = credit.release_date ?? credit.first_air_date;
    if (!source) return null;
    const parsed = Number(source.slice(0, 4));
    return Number.isFinite(parsed) ? parsed : null;
  })();

  return {
    id: credit.id,
    title: credit.title ?? credit.name ?? 'Sin título',
    year,
    mediaType: credit.media_type === 'tv' ? 'tv' : 'movie',
    posterUrl: credit.poster_path ? `${POSTER_BASE_URL}${credit.poster_path}` : undefined,
    voteCount: credit.vote_count ?? 0,
    sortDate: dateValue
  };
};

function splitOwnedCredits(list: CombinedCrewCredit[], ownedIds: Set<number>) {
  const owned: CombinedCrewCredit[] = [];
  const unowned: CombinedCrewCredit[] = [];
  for (const entry of list) {
    if (ownedIds.has(entry.id)) owned.push(entry);
    else unowned.push(entry);
  }
  return { owned, unowned };
}

const byDate = (a: CombinedCrewCredit, b: CombinedCrewCredit) => {
  const da = new Date(a.release_date ?? a.first_air_date ?? '1900-01-01').getTime();
  const db = new Date(b.release_date ?? b.first_air_date ?? '1900-01-01').getTime();
  return da - db;
};

export const DirectorPage: React.FC = () => {
  const { id } = useParams();
  const decodedParam = decodeURIComponent(id ?? '').trim();
  const { movies } = useMovies();
  const ownedTmdbIds = useMemo(() => buildOwnedTmdbIdSet(movies), [movies]);

  const runtimeCache = useRef<Map<number, boolean>>(new Map());

  const isShortMovie = useCallback(
    async (item: CombinedCrewCredit): Promise<boolean> => {
      if (item.media_type !== 'movie') return false;
      if (runtimeCache.current.has(item.id)) {
        return runtimeCache.current.get(item.id) ?? false;
      }

      try {
        const details = await tmdbFetchJson<MovieDetailsResponse>(
          `${API_BASE}/movie/${item.id}?language=es-ES`
        );
        const runtime = details.runtime ?? 0;
        const isShort = runtime > 0 && runtime < 60;
        runtimeCache.current.set(item.id, isShort);
        return isShort;
      } catch {
        runtimeCache.current.set(item.id, false);
        return false;
      }
    },
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string>('');
  const [biography, setBiography] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | undefined>();
  const [buckets, setBuckets] = useState<FilmographyBuckets>({ directed: [], created: [] });

  const displayName = personName || decodedParam;

  useEffect(() => {
    let active = true;
    async function loadDirector() {
      setLoading(true);
      setError(null);
      setBiography(null);
      setProfileUrl(undefined);
      const resolvedId = Number(decodedParam);
      if (!decodedParam || !Number.isFinite(resolvedId)) {
        setError('El identificador del director no es válido.');
        setLoading(false);
        return;
      }

      try {
        const [person, credits] = await Promise.all([
          tmdbFetchJson<PersonResponse>(`${API_BASE}/person/${resolvedId}?language=es-ES`),
          tmdbFetchJson<CombinedCreditsResponse>(
            `${API_BASE}/person/${resolvedId}/combined_credits?language=es-ES`
          )
        ]);

        if (!active) return;

        if (!person) {
          setError('No se encontró al director en TMDb.');
          setLoading(false);
          return;
        }

        setPersonName(person.name ?? decodedParam);
        setBiography(person.biography?.trim() ? person.biography : null);
        setProfileUrl(person.profile_path ? `${PROFILE_BASE_URL}${person.profile_path}` : undefined);

        const crewCredits = credits?.crew ?? [];

        const rawDirectorCredits = crewCredits.filter(
          (c) =>
            c.job === 'Director' &&
            (c.media_type === 'movie' || c.media_type === 'tv') &&
            c.video !== true
        );
        const rawCreatorCredits = crewCredits.filter(
          (c) =>
            c.job === 'Creator' &&
            (c.media_type === 'movie' || c.media_type === 'tv') &&
            c.video !== true
        );

        const dirSplit = splitOwnedCredits(rawDirectorCredits, ownedTmdbIds);
        const creSplit = splitOwnedCredits(rawCreatorCredits, ownedTmdbIds);

        const filteredDirectorUnowned: CombinedCrewCredit[] = [];
        for (const item of dirSplit.unowned) {
          if (await isShortMovie(item)) continue;
          if ((item.vote_count ?? 0) < 30) continue;
          filteredDirectorUnowned.push(item);
        }

        const filteredCreatorUnowned: CombinedCrewCredit[] = [];
        for (const item of creSplit.unowned) {
          if (await isShortMovie(item)) continue;
          if ((item.vote_count ?? 0) < 30) continue;
          filteredCreatorUnowned.push(item);
        }

        const directorList = [...dirSplit.owned, ...filteredDirectorUnowned].sort(byDate);
        const creatorList = [...creSplit.owned, ...filteredCreatorUnowned].sort(byDate);

        const seenDirector = new Set<number>();
        const seenCreator = new Set<number>();

        const directed = directorList
          .filter((entry) => {
            if (seenDirector.has(entry.id)) return false;
            seenDirector.add(entry.id);
            return true;
          })
          .map(mapCredit);

        const created = creatorList
          .filter((entry) => {
            if (seenCreator.has(entry.id)) return false;
            seenCreator.add(entry.id);
            return true;
          })
          .map(mapCredit);

        setBuckets({ directed, created });
      } catch (err) {
        console.warn('Error al cargar el director', err);
        if (active) setError('No se pudieron obtener los datos del director.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDirector();
    return () => {
      active = false;
    };
  }, [decodedParam, isShortMovie, ownedTmdbIds]);

  const renderList = (entries: FilmographyEntry[]) => {
    if (loading) return <p className="muted">Cargando filmografía...</p>;
    if (entries.length === 0) return <p className="muted">No hay obras para mostrar.</p>;

    return (
      <div className="known-for-grid">
        {entries.map((entry) => {
          const owned = ownedTmdbIds.has(entry.id);
          return (
            <div
              key={entry.id}
              className={`known-for-card ${owned ? 'owned' : 'missing'}`}
              aria-label={owned ? 'En la colección' : 'Fuera de la colección'}
            >
              <div className="known-for-card__poster">
                {entry.posterUrl ? (
                  <img
                    src={entry.posterUrl}
                    alt={entry.title}
                    className={!owned ? 'is-muted' : undefined}
                    loading="lazy"
                  />
                ) : (
                  <div className={`poster-fallback ${!owned ? 'is-muted' : ''}`} aria-hidden />
                )}
              </div>
              <div className="known-for-card__meta">
                <p className={!owned ? 'muted' : undefined}>{entry.title}</p>
                <small className="muted">
                  {entry.mediaType === 'tv' ? 'TV' : 'Cine'}
                  {entry.year ? ` • ${entry.year}` : ''}
                </small>
                <span className="pill">{owned ? 'En la colección' : 'Pendiente'}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <Link to="/directors" className="btn" style={{ padding: '6px 12px' }}>
          ← Volver a directores
        </Link>
      </div>
      <div className="director-hero">
        <div
          className="director-portrait"
          style={{ backgroundImage: `url(${profileUrl ?? FALLBACK_PORTRAIT})` }}
          aria-hidden="true"
        />
        <div className="director-legend">
          <p className="eyebrow">Directores</p>
          <h1>{displayName}</h1>
          {loading && <p className="text-muted">Recopilando biografía...</p>}
          {!loading && biography && <p className="text-muted">{biography}</p>}
          {!loading && !biography && <p className="text-muted">Biografía no disponible.</p>}
        </div>
      </div>

      <div className="filmography-block">
        <h2>Obras como director</h2>
        <p className="text-muted">Directed works: {buckets.directed.length}</p>
        {error ? <p className="muted">{error}</p> : renderList(buckets.directed)}
      </div>

      <div className="filmography-block">
        <h2>Obras como creador</h2>
        <p className="text-muted">Created works: {buckets.created.length}</p>
        {error ? <p className="muted">{error}</p> : renderList(buckets.created)}
      </div>
    </section>
  );
};
