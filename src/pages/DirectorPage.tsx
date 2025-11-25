import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { DirectedMovie, fetchDirectorFromTMDb } from '../services/tmdbPeopleService';
import { MovieRecord } from '../types/MovieRecord';
import { buildDirectorOverrideMap, normalizeDirectorName } from '../services/directors';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

const isMovieInCollection = (tmdbId: number, collection: MovieRecord[]): boolean => {
  return collection.some((item) => item.tmdbId === tmdbId);
};

export const DirectorPage: React.FC = () => {
  const { name } = useParams();
  const directorName = decodeURIComponent(name ?? '').trim();
  const { movies } = useMovies();
  const directorOverrides = useMemo(() => buildDirectorOverrideMap(movies), [movies]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string>(directorName);
  const [biography, setBiography] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | undefined>();
  const [knownFor, setKnownFor] = useState<DirectedMovie[]>([]);
  const [createdWorks, setCreatedWorks] = useState<DirectedMovie[]>([]);

  useEffect(() => {
    let active = true;
    async function loadDirector() {
      setLoading(true);
      setError(null);
      setBiography(null);
      setProfileUrl(undefined);
      setKnownFor([]);
      setCreatedWorks([]);

      if (!directorName) {
        setError('No se especificó director.');
        setLoading(false);
        return;
      }

      try {
        const overrideTmdbId = directorOverrides.get(normalizeDirectorName(directorName));
        const result = await fetchDirectorFromTMDb({ name: directorName, tmdbId: overrideTmdbId });
        if (!active) return;

        if (!result) {
          setError('No se encontró al director en TMDb.');
          setLoading(false);
          return;
        }

        setPersonName(result.person?.name ?? result.resolvedName ?? directorName);
        setBiography(result.person?.biography ?? null);
        setProfileUrl(result.person?.profileUrl ?? undefined);
        setKnownFor(result.credits);
        setCreatedWorks(result.created);
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
  }, [directorName, directorOverrides]);

  const curatedKnownFor = useMemo(() => {
    const seen = new Set<number>();
    return knownFor
      .filter((movie) => {
        if (seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
      });
  }, [knownFor]);

  const curatedCreatedWorks = useMemo(() => {
    const seen = new Set<number>();
    return createdWorks.filter((project) => {
      if (seen.has(project.id)) return false;
      seen.add(project.id);
      return true;
    });
  }, [createdWorks]);

  const renderProjects = (projects: DirectedMovie[], options: { emptyLabel: string; loadingLabel: string }) => {
    if (loading) {
      return <p className="muted">{options.loadingLabel}</p>;
    }
    if (projects.length === 0) {
      return <p className="muted">{options.emptyLabel}</p>;
    }
    return (
      <div className="known-for-grid">
        {projects.map((project) => {
          const owned = isMovieInCollection(project.id, movies);
          return (
            <div
              key={project.id}
              className={`known-for-card ${owned ? 'owned' : 'missing'}`}
              aria-label={owned ? 'En la colección' : 'Fuera de la colección'}
            >
              <div className="known-for-card__poster">
                {project.posterUrl ? (
                  <img src={project.posterUrl} alt={project.title} className={!owned ? 'is-muted' : undefined} />
                ) : (
                  <div className={`poster-fallback ${!owned ? 'is-muted' : ''}`} aria-hidden />
                )}
              </div>
              <div className="known-for-card__meta">
                <p className={!owned ? 'muted' : undefined}>{project.title}</p>
                {project.year && <small>{project.year}</small>}
                <div className="known-for-card__tags">
                  <span className="pill pill--type">{project.mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                  <span className="pill">{owned ? 'En la colección' : 'Pendiente'}</span>
                </div>
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
        <h2>Filmografía</h2>
        <p className="text-muted">Películas y series dirigidas según TMDb (combinado), resaltando las que ya están en la colección.</p>
        {error ? (
          <p className="muted">{error}</p>
        ) : (
          renderProjects(curatedKnownFor, {
            loadingLabel: 'Cargando filmografía destacada...',
            emptyLabel: 'No hay producciones para mostrar.'
          })
        )}
      </div>

      <div className="filmography-block">
        <h3>Como creador</h3>
        <p className="text-muted">Series y películas en las que figura como creador, ordenadas por año.</p>
        {error ? (
          <p className="muted">{error}</p>
        ) : (
          renderProjects(curatedCreatedWorks, {
            loadingLabel: 'Buscando proyectos creados...',
            emptyLabel: 'No hay créditos como creador para mostrar.'
          })
        )}
      </div>
    </section>
  );
};
