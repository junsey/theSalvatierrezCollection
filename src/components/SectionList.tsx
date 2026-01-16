import React, { useMemo } from 'react';
import { MovieRecord } from '../types/MovieRecord';
import { SectionCard } from './SectionCard';

type OrderBy = 'pending' | 'largest' | 'alpha';

export const SectionList: React.FC<{ movies: MovieRecord[]; orderBy: OrderBy }> = ({ movies, orderBy }) => {
  const sections = Array.from(new Set(movies.map((m) => m.seccion))).sort();
  const sectionStats = movies.reduce<Record<string, { total: number; seen: number }>>((acc, movie) => {
    if (!acc[movie.seccion]) {
      acc[movie.seccion] = { total: 0, seen: 0 };
    }
    acc[movie.seccion].total += 1;
    if (movie.seen) acc[movie.seccion].seen += 1;
    return acc;
  }, {});

  const sectionItems = useMemo(() => {
    return sections.map((section) => {
      const stats = sectionStats[section] ?? { total: 0, seen: 0 };
      const pending = Math.max(stats.total - stats.seen, 0);
      return {
        name: section,
        total: stats.total,
        seen: stats.seen,
        pending
      };
    });
  }, [sections, sectionStats]);

  const sortedItems = useMemo(() => {
    const items = [...sectionItems];
    switch (orderBy) {
      case 'largest':
        return items.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
      case 'alpha':
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'pending':
      default:
        return items.sort((a, b) => b.pending - a.pending || b.total - a.total || a.name.localeCompare(b.name));
    }
  }, [orderBy, sectionItems]);

  const featured = sortedItems.slice(0, 5);
  const rest = sortedItems.slice(5);

  return (
    <>
      {featured.length > 0 && (
        <div className="section-featured">
          <div className="section-featured__header">
            <h2>Destacados</h2>
            <span className="muted">Secciones con más pendientes</span>
          </div>
          <div className="section-featured__grid">
            {featured.map((section) => (
              <SectionCard key={section.name} name={section.name} total={section.total} seen={section.seen} featured />
            ))}
          </div>
        </div>
      )}
      <div className="section-grid">
        {rest.map((section) => (
          <SectionCard key={section.name} name={section.name} total={section.total} seen={section.seen} />
        ))}
      </div>
    </>
  );
};
