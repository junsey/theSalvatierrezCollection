import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import sectionSigil from '../assets/section-sigil.svg';
import { getSectionArt } from '../data/sectionArt';

export const SectionList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const sections = Array.from(new Set(movies.map((m) => m.seccion))).sort();
  const sectionStats = movies.reduce<Record<string, { total: number; seen: number }>>((acc, movie) => {
    if (!acc[movie.seccion]) {
      acc[movie.seccion] = { total: 0, seen: 0 };
    }
    acc[movie.seccion].total += 1;
    if (movie.seen) acc[movie.seccion].seen += 1;
    return acc;
  }, {});
  return (
    <div className="section-grid">
      {sections.map((section) => (
        <Link key={section} to={`/sections/${encodeURIComponent(section)}`} className="section-card">
          <div
            className="section-thumb"
            style={{ backgroundImage: `url(${getSectionArt(section)})` }}
            aria-hidden="true"
          />
          <div className="card-crest" aria-hidden="true">
            <img src={sectionSigil} alt="" />
          </div>
          <div className="section-meta">
            <strong className="section-title">{section}</strong>
            <small className="section-count">{sectionStats[section]?.total ?? 0} películas</small>
            <small className="section-count">{sectionStats[section]?.seen ?? 0} vistas</small>
          </div>
        </Link>
      ))}
    </div>
  );
};
