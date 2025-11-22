import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import sectionSigil from '../assets/section-sigil.svg';

export const SectionList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const sections = Array.from(new Set(movies.map((m) => m.seccion))).sort();
  return (
    <div className="section-grid">
      {sections.map((section) => (
        <Link key={section} to={`/sections/${encodeURIComponent(section)}`} className="section-card">
          <div className="card-crest" aria-hidden="true">
            <img src={sectionSigil} alt="" />
          </div>
          <strong>{section}</strong>
          <small>{movies.filter((m) => m.seccion === section).length} films</small>
        </Link>
      ))}
    </div>
  );
};
