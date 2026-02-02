import React, { useMemo } from 'react';
import { MovieRecord } from '../types/MovieRecord';
import { SectionCard } from './SectionCard';

type OrderBy = 'pending' | 'largest' | 'alpha';

const getMovieRating = (movie: MovieRecord) => {
  const values = [movie.ratingGloria, movie.ratingRodrigo, movie.rating].filter(
    (value): value is number => value != null
  );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const pickSectionBackground = (movies: MovieRecord[]) => {
  const rated = movies
    .map((movie) => ({ movie, rating: getMovieRating(movie) }))
    .filter((entry): entry is { movie: MovieRecord; rating: number } => entry.rating != null)
    .filter((entry) => Boolean(entry.movie.posterUrl));

  if (rated.length > 0) {
    rated.sort((a, b) => b.rating - a.rating);
    return rated[0].movie.posterUrl ?? null;
  }

  const withPoster = movies.filter((movie) => Boolean(movie.posterUrl));
  if (withPoster.length === 0) return null;
  const pick = withPoster[Math.floor(Math.random() * withPoster.length)];
  return pick.posterUrl ?? null;
};

export const SectionList: React.FC<{ movies: MovieRecord[]; orderBy: OrderBy; basePath?: string }> = ({
  movies,
  orderBy,
  basePath
}) => {
  const sectionGroups = useMemo(() => {
    const map = new Map<string, MovieRecord[]>();
    movies.forEach((movie) => {
      const key = movie.seccion;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(movie);
    });
    return map;
  }, [movies]);

  const sectionItems = useMemo(() => {
    return Array.from(sectionGroups.entries())
      .map(([section, items]) => {
        const total = items.length;
        const seen = items.filter((movie) => movie.seen).length;
        const pending = Math.max(total - seen, 0);
        return {
          name: section,
          total,
          seen,
          pending,
          backgroundUrl: pickSectionBackground(items)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sectionGroups]);

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
              <SectionCard
                key={section.name}
                name={section.name}
                total={section.total}
                seen={section.seen}
                backgroundUrl={section.backgroundUrl}
                featured
                basePath={basePath}
              />
            ))}
          </div>
        </div>
      )}
      <div className="section-grid">
        {rest.map((section) => (
          <SectionCard
            key={section.name}
            name={section.name}
            total={section.total}
            seen={section.seen}
            backgroundUrl={section.backgroundUrl}
            basePath={basePath}
          />
        ))}
      </div>
    </>
  );
};
