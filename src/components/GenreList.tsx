import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import sectionSigil from '../assets/section-sigil.svg';

const extractGenres = (movie: MovieRecord) => {
  const raw = movie.genreRaw.split(/[,;\-/]/g).map((g) => g.trim()).filter(Boolean);
  const tmdb = movie.tmdbGenres ?? [];
  return Array.from(new Set([...raw, ...tmdb]));
};

export const GenreList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const genreStats = movies.reduce<Record<string, { total: number; seen: number }>>((acc, movie) => {
    extractGenres(movie).forEach((genre) => {
      if (!acc[genre]) acc[genre] = { total: 0, seen: 0 };
      acc[genre].total += 1;
      if (movie.seen) acc[genre].seen += 1;
    });
    return acc;
  }, {});

  const genres = Object.keys(genreStats).sort((a, b) => a.localeCompare(b));

  return (
    <div className="section-grid">
      {genres.map((genre) => (
        <Link key={genre} to={`/genres/${encodeURIComponent(genre)}`} className="section-card">
          <div className="section-thumb" style={{ backgroundImage: 'linear-gradient(180deg, #0c0f18, #1b1f2a)' }} aria-hidden="true" />
          <div className="card-crest" aria-hidden="true">
            <img src={sectionSigil} alt="" />
          </div>
          <div className="section-meta">
            <strong className="section-title">{genre}</strong>
            <small className="section-count">{genreStats[genre]?.total ?? 0} películas</small>
            <small className="section-count">{genreStats[genre]?.seen ?? 0} vistas</small>
          </div>
        </Link>
      ))}
    </div>
  );
};
