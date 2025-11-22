import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiltersBar } from '../components/FiltersBar';
import { MovieCard } from '../components/MovieCard';
import { MovieDetail } from '../components/MovieDetail';
import { MovieTable } from '../components/MovieTable';
import { useMovies } from '../context/MovieContext';
import { getDirectorProfile } from '../data/directorProfiles';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

const baseFilters: MovieFilters = {
  query: '',
  seccion: null,
  genre: null,
  seen: 'all',
  view: 'grid',
  sort: 'title-asc'
};

const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

const matchesDirector = (movie: MovieRecord, directorName: string) => {
  const target = directorName.toLowerCase();
  return (
    splitDirectors(movie.director).some((d) => d.toLowerCase() === target) ||
    movie.director.toLowerCase().includes(target)
  );
};

export const DirectorPage: React.FC = () => {
  const { name } = useParams();
  const { movies, updateSeen, updateRating, updateNote, ratings, notes } = useMovies();
  const directorName = decodeURIComponent(name ?? '');
  const profile = getDirectorProfile(directorName);
  const [filters, setFilters] = useState<MovieFilters>({ ...baseFilters });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const directorMovies = useMemo(() => movies.filter((m) => matchesDirector(m, directorName)), [movies, directorName]);

  const directorStats = useMemo(() => {
    const total = directorMovies.length;
    const seen = directorMovies.filter((m) => m.seen).length;
    return { total, seen };
  }, [directorMovies]);

  const collectionTitles = useMemo(
    () => directorMovies.map((m) => m.title.toLowerCase()),
    [directorMovies]
  );

  const suggestedFilmography = useMemo(() => {
    const planned = profile.filmography ?? [];
    return planned.map((title) => ({
      title,
      inCollection: collectionTitles.includes(title.toLowerCase()),
    }));
  }, [profile.filmography, collectionTitles]);

  const filtered = useMemo(() => {
    return directorMovies
      .filter((m) => m.title.toLowerCase().includes(filters.query.toLowerCase()))
      .filter((m) => (filters.seccion ? m.seccion === filters.seccion : true))
      .filter((m) => {
        if (filters.genre) {
          return m.genreRaw.toLowerCase().includes(filters.genre.toLowerCase());
        }
        return true;
      })
      .filter((m) => {
        if (filters.seen === 'all') return true;
        if (filters.seen === 'seen') return m.seen;
        return !m.seen;
      })
      .sort((a, b) => {
        switch (filters.sort) {
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'year-asc':
            return (a.year ?? 0) - (b.year ?? 0);
          case 'year-desc':
            return (b.year ?? 0) - (a.year ?? 0);
          case 'tmdb-asc':
            return (a.tmdbRating ?? 0) - (b.tmdbRating ?? 0);
          case 'tmdb-desc':
            return (b.tmdbRating ?? 0) - (a.tmdbRating ?? 0);
          case 'rating-asc': {
            const ra = ratings[a.id] ?? null;
            const rb = ratings[b.id] ?? null;
            return (ra ?? 0) - (rb ?? 0);
          }
          case 'rating-desc': {
            const ra = ratings[a.id] ?? null;
            const rb = ratings[b.id] ?? null;
            return (rb ?? 0) - (ra ?? 0);
          }
          case 'title-asc':
          default:
            return a.title.localeCompare(b.title);
        }
      });
  }, [directorMovies, filters, ratings]);

  return (
    <section>
      <div className="director-hero">
        <div
          className="director-portrait"
          style={{ backgroundImage: `url(${profile.image})` }}
          aria-hidden="true"
        />
        <div className="director-legend">
          <p className="eyebrow">Directores</p>
          <h1>{directorName}</h1>
          <p className="text-muted">{profile.bio}</p>
          <div className="stats-row">
            <div className="stat-pill">
              <strong>{directorStats.total}</strong>
              <span>películas en la colección</span>
            </div>
            <div className="stat-pill">
              <strong>{directorStats.seen}</strong>
              <span>vistas</span>
            </div>
          </div>
        </div>
      </div>
      <FiltersBar filters={filters} onChange={(patch) => setFilters({ ...filters, ...patch })} movies={directorMovies} />
      {filters.view === 'grid' ? (
        <div className="movie-grid">
          {filtered.map((movie) => (
            <MovieCard key={movie.id} movie={movie} personalRating={ratings[movie.id]} onClick={() => setActiveMovie(movie)} />
          ))}
        </div>
      ) : (
        <MovieTable movies={filtered} personalRatings={ratings} onSelect={setActiveMovie} />
      )}
      {activeMovie && (
        <MovieDetail
          movie={activeMovie}
          personalRating={ratings[activeMovie.id]}
          personalNote={notes[activeMovie.id]}
          onClose={() => setActiveMovie(null)}
          onSeenChange={(seen) => updateSeen(activeMovie.id, seen)}
          onRatingChange={(rating) => updateRating(activeMovie.id, rating)}
          onNoteChange={(note) => updateNote(activeMovie.id, note)}
        />
      )}
      {suggestedFilmography.length > 0 && (
        <div className="filmography-block">
          <h2>Filmografía sugerida</h2>
          <p className="text-muted">
            Títulos clave del director para completar la colección. Los que ya tienes aparecen como marcados.
          </p>
          <ul className="filmography-list">
            {suggestedFilmography.map((entry) => (
              <li key={entry.title} className={entry.inCollection ? 'owned' : 'pending'}>
                <span>{entry.title}</span>
                <span className="pill">{entry.inCollection ? 'En la colección' : 'Pendiente'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
