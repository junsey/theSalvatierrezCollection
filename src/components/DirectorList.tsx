import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DirectorProfile, buildDirectorProfiles } from '../services/tmdbPeopleService';
import { MovieRecord } from '../types/MovieRecord';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

export const DirectorList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const directorNames = useMemo(
    () =>
      Array.from(
        new Set(
          movies
            .flatMap((m) => splitDirectors(m.director))
            .filter(Boolean)
        )
      ).sort(),
    [movies]
  );

  const [profiles, setProfiles] = useState<DirectorProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      if (directorNames.length === 0) {
        setProfiles([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const enriched = await buildDirectorProfiles(directorNames);
        if (!active) return;
        setProfiles(enriched);
      } catch (err) {
        console.warn('No se pudieron cargar los directores', err);
        if (active) setError('No se pudieron cargar los directores.');
      } finally {
        if (active) setLoading(false);
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, [directorNames]);

  if (loading) {
    return <p className="muted">Cargando directores...</p>;
  }

  if (error) {
    return <p className="muted">{error}</p>;
  }

  return (
    <div className="director-grid">
      {profiles.map((director) => (
        <Link
          to={`/directors/${encodeURIComponent(director.displayName || director.name)}`}
          className="director-card"
          key={director.name}
        >
          <div
            className="director-thumb"
            style={{ backgroundImage: `url(${director.profileUrl || FALLBACK_PORTRAIT})` }}
            aria-hidden
          />
          <div className="section-meta">
            <strong className="section-title">{director.displayName || director.name}</strong>
            <small className="section-count">Ver perfil</small>
          </div>
        </Link>
      ))}
    </div>
  );
};
