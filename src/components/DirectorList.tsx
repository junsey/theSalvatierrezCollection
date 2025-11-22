import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import directorSigil from '../assets/director-sigil.svg';
import { getDirectorProfile } from '../data/directorProfiles';

const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

export const DirectorList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const directors = Array.from(
    new Set(
      movies
        .flatMap((m) => splitDirectors(m.director))
        .filter(Boolean)
    )
  ).sort();

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
        return (
          <Link key={director} to={`/directors/${encodeURIComponent(director)}`} className="director-card">
            <div
              className="director-thumb"
              style={{ backgroundImage: `url(${profile.image})` }}
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
