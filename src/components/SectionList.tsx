import React from 'react';
import { MovieRecord } from '../types/MovieRecord';
import { SectionCard } from './SectionCard';

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
        <SectionCard
          key={section}
          name={section}
          total={sectionStats[section]?.total ?? 0}
          seen={sectionStats[section]?.seen ?? 0}
        />
      ))}
    </div>
  );
};
