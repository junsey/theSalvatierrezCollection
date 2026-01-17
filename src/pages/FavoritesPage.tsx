import React, { useMemo, useState } from 'react';
import { MovieDetail } from '../components/MovieDetail';
import { PawRating } from '../components/PawRating';
import { useMovies } from '../context/MovieContext';
import { MovieRecord } from '../types/MovieRecord';

type FilterMode = 'house' | 'rodrigo' | 'gloria';

type RankedMovie = {
  movie: MovieRecord;
  score: number;
};

export const FavoritesPage: React.FC = () => {
  const { visibleMovies, loading } = useMovies();
  const [mode, setMode] = useState<FilterMode>('house');
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const ranked = useMemo(() => {
    const base = visibleMovies.filter(
      (movie) => movie.seen && movie.ratingGloria != null && movie.ratingRodrigo != null
    );
    const scored: RankedMovie[] = base.map((movie) => {
      const score =
        mode === 'rodrigo'
          ? movie.ratingRodrigo ?? 0
          : mode === 'gloria'
          ? movie.ratingGloria ?? 0
          : ((movie.ratingGloria ?? 0) + (movie.ratingRodrigo ?? 0)) / 2;
      return { movie, score };
    });
    return scored.sort((a, b) => b.score - a.score);
  }, [mode, visibleMovies]);

  const titleMap: Record<FilterMode, string> = {
    house: 'Mejores de la casa',
    rodrigo: 'Ranking de Rodrigo',
    gloria: 'Ranking de Gloria'
  };

  return (
    <section className="favorites-page">
      <header className="panel favorites-hero">
        <div>
          <p className="eyebrow">Favoritos</p>
          <h1>{titleMap[mode]}</h1>
          <p className="muted">
            Solo peliculas vistas con puntuaciones completas de Gloria y Rodrigo.
          </p>
        </div>
        <div className="favorites-filter">
          <button
            className={`ghost ${mode === 'house' ? 'is-active' : ''}`}
            onClick={() => setMode('house')}
          >
            General
          </button>
          <button
            className={`ghost ${mode === 'rodrigo' ? 'is-active' : ''}`}
            onClick={() => setMode('rodrigo')}
          >
            Rodrigo
          </button>
          <button
            className={`ghost ${mode === 'gloria' ? 'is-active' : ''}`}
            onClick={() => setMode('gloria')}
          >
            Gloria
          </button>
        </div>
      </header>

      {loading ? (
        <p className="muted">Invocando favoritos...</p>
      ) : ranked.length === 0 ? (
        <p className="muted">No hay peliculas con puntuaciones completas aun.</p>
      ) : (
        <div className="favorites-grid">
          {ranked.map(({ movie, score }, index) => {
            const medalClass =
              index === 0
                ? 'favorite-card--gold'
                : index === 1
                ? 'favorite-card--silver'
                : index === 2
                ? 'favorite-card--bronze'
                : '';
            return (
              <button
                key={movie.id}
                className={`favorite-card ${medalClass}`}
                type="button"
                onClick={() => setActiveMovie(movie)}
              >
                <div className="favorite-card__badge">#{index + 1}</div>
                <div className="favorite-card__poster">
                  <img
                    src={movie.posterUrl ?? 'https://via.placeholder.com/240x360/0b0f17/ffffff?text=No+Poster'}
                    alt={movie.title}
                    loading="lazy"
                  />
                </div>
                <div className="favorite-card__body">
                  <strong>{movie.title}</strong>
                  <small className="muted">
                    {movie.tmdbYear ?? movie.year ?? 'Year ?'} - {movie.seccion}
                  </small>
                  <div className="favorite-card__ratings">
                    <div>
                      <span className="favorite-card__label">Score</span>
                      <PawRating value={score} size="small" />
                    </div>
                    <div className="favorite-card__split">
                      <span>G: {movie.ratingGloria?.toFixed(1)}</span>
                      <span>R: {movie.ratingRodrigo?.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeMovie && <MovieDetail movie={activeMovie} onClose={() => setActiveMovie(null)} />}
    </section>
  );
};
