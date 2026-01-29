import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';

type OrderBy = 'pending' | 'largest' | 'alpha';

type SagaItem = {
  name: string;
  total: number;
  seen: number;
  pending: number;
  backgroundUrl: string | null;
};

const DEFAULT_SAGA_BG = '/assets/sections/default.jpg';

const pickRandomPoster = (movies: MovieRecord[]) => {
  const withPoster = movies.filter((movie) => Boolean(movie.posterUrl));
  if (withPoster.length === 0) return null;
  const pick = withPoster[Math.floor(Math.random() * withPoster.length)];
  return pick.posterUrl ?? null;
};

export const SagaList: React.FC<{ movies: MovieRecord[]; orderBy: OrderBy }> = ({ movies, orderBy }) => {
  const sagaItems = useMemo(() => {
    const map = new Map<string, MovieRecord[]>();
    movies.forEach((movie) => {
      const saga = (movie.saga ?? '').trim();
      if (!saga) return;
      if (!map.has(saga)) {
        map.set(saga, []);
      }
      map.get(saga)!.push(movie);
    });

    const items: SagaItem[] = [];
    map.forEach((itemsForSaga, saga) => {
      if (itemsForSaga.length <= 1) return;
      const total = itemsForSaga.length;
      const seen = itemsForSaga.filter((movie) => movie.seen).length;
      items.push({
        name: saga,
        total,
        seen,
        pending: Math.max(total - seen, 0),
        backgroundUrl: pickRandomPoster(itemsForSaga)
      });
    });

    return items;
  }, [movies]);

  const sortedItems = useMemo(() => {
    const items = [...sagaItems];
    switch (orderBy) {
      case 'largest':
        return items.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
      case 'alpha':
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'pending':
      default:
        return items.sort((a, b) => b.pending - a.pending || b.total - a.total || a.name.localeCompare(b.name));
    }
  }, [orderBy, sagaItems]);

  if (sortedItems.length === 0) {
    return <p className="muted" style={{ padding: '12px 0' }}>No hay sagas con más de una película.</p>;
  }

  return (
    <div className="section-grid">
      {sortedItems.map((saga) => (
        <Link
          key={saga.name}
          to={`/movies?saga=${encodeURIComponent(saga.name)}`}
          className="section-card"
        >
          <div
            className="section-card__bg"
            style={{ backgroundImage: `url(${saga.backgroundUrl ?? DEFAULT_SAGA_BG})` }}
            aria-hidden="true"
          />
          <div className="section-card__overlay" aria-hidden="true" />
          <span className="section-card__badge">{saga.total} pelis</span>
          <div className="section-card__content">
            <div className="section-card__title">{saga.name}</div>
            <div className="section-card__meta">
              {saga.seen} / {saga.total} vistas
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};
