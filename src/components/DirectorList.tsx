import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import directorSigil from '../assets/director-sigil.svg';
import { getDirectorProfile } from '../data/directorProfiles';
import { fetchAllDirectorProfiles } from '../services/supabaseDirectors';

const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

export const DirectorList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const directors = Array.from(
    new Set(
      movies
        .flatMap((m) => splitDirectors(m.director))
        .filter(Boolean)
    )
  ).sort();

  const directorKeys = useMemo(() => directors.map((director) => director.toLowerCase()), [directors]);

  useEffect(() => {
    let active = true;
    async function loadProfiles() {
      try {
        const map = await fetchAllDirectorProfiles();
        if (!active) return;
        setProfileMap(map);
      } catch (error) {
        console.warn('No se pudieron cargar retratos desde Supabase', error);
      }
    }
    if (directorKeys.length > 0) {
      loadProfiles();
    }
    return () => {
      active = false;
    };
  }, [directorKeys.length]);

  const directorStats = movies.reduce<Record<string, { total: number; seen: number }>>((acc, movie) => {
    splitDirectors(movie.director).forEach((d) => {
      if (!acc[d]) {
        acc[d] = { total: 0, seen: 0 };
      }
      acc[d].total += 1;
      if (movie.seen) acc[d].seen += 1;
    });
    return acc;
  }, {});

  return (
    <div className="director-grid">
      {directors.map((director) => {
        const profile = getDirectorProfile(director);
        const supabaseImage = profileMap[director.toLowerCase()];
        return (
          <Link key={director} to={`/directors/${encodeURIComponent(director)}`} className="director-card">
            <div
              className="director-thumb"
              style={{ backgroundImage: `url(${supabaseImage ?? profile.image})` }}
              aria-hidden="true"
            />
            <div className="card-crest" aria-hidden="true">
              <img src={directorSigil} alt="" />
            </div>
            <div className="section-meta">
              <strong className="section-title">{director}</strong>
              <small className="section-count">{directorStats[director]?.total ?? 0} películas</small>
              <small className="section-count">{directorStats[director]?.seen ?? 0} vistas</small>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
