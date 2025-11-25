import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { buildOwnedTmdbIdSet } from '../services/directors';
import {
  DirectorWorks,
  fetchTMDB,
  getDirectorWorks,
  setDirectorOwnedIdsFromMovies
} from '../services/directorWorks';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';

type PersonResponse = {
  id: number;
  name: string;
  biography?: string | null;
  profile_path?: string | null;
};

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

export const DirectorPage: React.FC = () => {
  const { id } = useParams();
  const decodedParam = decodeURIComponent(id ?? '').trim();
  const { movies } = useMovies();
  const ownedTmdbIds = useMemo(() => buildOwnedTmdbIdSet(movies), [movies]);
  const [works, setWorks] = useState<DirectorWorks | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setPersonName] = useState<string>('');
  const [biography, setBiography] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | undefined>(undefined);
  const [buckets, setBuckets] = useState<FilmographyBuckets>({ directed: [], created: [] });

  useEffect(() => {
    setDirectorOwnedIdsFromMovies(movies);
  }, [movies]);

  useEffect(() => {
    let active = true;
    async function loadDirector() {
      setLoading(true);
      setError(null);
      setBiography(null);
      setProfileUrl(undefined);
      setWorks(null);
      const resolvedId = Number(decodedParam);
      if (!decodedParam || !Number.isFinite(resolvedId)) {
        setError('El identificador del director no es válido.');
        setLoading(false);
        return;
      }

      try {
        const [person, processedWorks] = await Promise.all([
          fetchTMDB<PersonResponse>(`/person/${resolvedId}?language=es-ES`),
          getDirectorWorks(resolvedId)
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

        const directed = processedWorks.directorList.map(mapCredit);
        const created = processedWorks.creatorList.map(mapCredit);
        setWorks(processedWorks);
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
  }, [decodedParam]);

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
        <p className="text-muted">Directed works: {works?.directorCount ?? buckets.directed.length}</p>
        {error ? <p className="muted">{error}</p> : renderList(buckets.directed)}
      </div>

      <div className="filmography-block">
        <h2>Obras como creador</h2>
        <p className="text-muted">Created works: {works?.creatorCount ?? buckets.created.length}</p>
        {error ? <p className="muted">{error}</p> : renderList(buckets.created)}
      </div>

      <div className="filmography-block">
        <p className="text-muted">Total works: {works?.totalCount ?? buckets.directed.length + buckets.created.length}</p>
      </div>
    </section>
  );
};
