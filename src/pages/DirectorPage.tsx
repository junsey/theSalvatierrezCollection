import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { DirectedMovie, getPersonDirectedMovies, getPersonDetails, searchPersonByName } from '../services/tmdbPeopleService';
import { MovieRecord } from '../types/MovieRecord';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

const isMovieInCollection = (tmdbId: number, collection: MovieRecord[]): boolean => {
  return collection.some((item) => item.tmdbId === tmdbId);
};

export const DirectorPage: React.FC = () => {
  const { name } = useParams();
  const directorName = decodeURIComponent(name ?? '').trim();
  const { movies } = useMovies();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string>(directorName);
  const [biography, setBiography] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | undefined>();
  const [knownFor, setKnownFor] = useState<DirectedMovie[]>([]);

  useEffect(() => {
    let active = true;
    async function loadDirector() {
      setLoading(true);
      setError(null);
      setBiography(null);
      setProfileUrl(undefined);
      setKnownFor([]);

      if (!directorName) {
        setError('No se especificó director.');
        setLoading(false);
        return;
      }

      try {
        const search = await searchPersonByName(directorName);
        if (!active) return;
        if (!search) {
          setError('No se encontró al director en TMDb.');
          setLoading(false);
          return;
        }
        setPersonName(search.name);

        const [details, filmography] = await Promise.all([
          getPersonDetails(search.id),
          getPersonDirectedMovies(search.id)
        ]);
        if (!active) return;

        setBiography(details?.biography ?? null);
        setProfileUrl(details?.profileUrl ?? undefined);
        setKnownFor(filmography);
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
  }, [directorName]);

  const curatedKnownFor = useMemo(() => {
    const seen = new Set<number>();
    return knownFor
      .filter((movie) => {
        if (seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
      })
      .slice(0, 12);
  }, [knownFor]);

  const renderKnownFor = () => {
    if (loading) {
      return <p className="muted">Cargando filmografía destacada...</p>;
    }
    if (curatedKnownFor.length === 0) {
      return <p className="muted">No hay películas para mostrar.</p>;
    }
    return (
      <div className="known-for-grid">
        {curatedKnownFor.map((movie) => {
          const owned = isMovieInCollection(movie.id, movies);
          return (
            <div
              key={movie.id}
              className={`known-for-card ${owned ? 'owned' : 'missing'}`}
              aria-label={owned ? 'En la colección' : 'Fuera de la colección'}
            >
              <div className="known-for-card__poster">
                {movie.posterUrl ? (
                  <img src={movie.posterUrl} alt={movie.title} className={!owned ? 'is-muted' : undefined} />
                ) : (
                  <div className={`poster-fallback ${!owned ? 'is-muted' : ''}`} aria-hidden />
                )}
              </div>
              <div className="known-for-card__meta">
                <p className={!owned ? 'muted' : undefined}>{movie.title}</p>
                {movie.year && <small>{movie.year}</small>}
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
          <h1>{personName || directorName}</h1>
          {loading && <p className="text-muted">Recopilando biografía...</p>}
          {!loading && biography && <p className="text-muted">{biography}</p>}
          {!loading && !biography && <p className="text-muted">Biografía no disponible.</p>}
        </div>
      </div>

      <div className="filmography-block">
        <h2>Conocido por</h2>
        <p className="text-muted">Películas dirigidas según TMDb, resaltando las que ya están en la colección.</p>
        {error ? <p className="muted">{error}</p> : renderKnownFor()}
      </div>
    </section>
  );
};
