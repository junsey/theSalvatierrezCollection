import React, { useEffect, useMemo, useState } from 'react';
import { useMovies } from '../context/MovieContext';
import { updateMovieStatus } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
}

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

const getGenres = (movie: MovieRecord) => {
  const raw = movie.genreRaw ? movie.genreRaw.split(',').map((g) => g.trim()) : [];
  const tmdb = movie.tmdbGenres ?? [];
  return unique([...raw, ...tmdb]);
};

const getMovieAverage = (movie: MovieRecord) => {
  if (movie.ratingGloria != null && movie.ratingRodrigo != null) {
    return (movie.ratingGloria + movie.ratingRodrigo) / 2;
  }
  if (movie.ratingGloria != null) return movie.ratingGloria;
  if (movie.ratingRodrigo != null) return movie.ratingRodrigo;
  return null;
};

export const SurpriseMovieNight: React.FC<Props> = ({ movies, onSelect }) => {
  const { adminSession, applyMovieStatusUpdate } = useMovies();
  const [contentType, setContentType] = useState<'movies' | 'series' | 'both'>('movies');
  const [invocationMode, setInvocationMode] = useState<'single' | 'double'>('single');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSagas, setSelectedSagas] = useState<string[]>([]);
  const [selectedDirectors, setSelectedDirectors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [excludeViewed, setExcludeViewed] = useState(true);
  const [onlyViewed, setOnlyViewed] = useState(false);
  const [includeDamaged, setIncludeDamaged] = useState(false);
  const [isInvoking, setIsInvoking] = useState(false);
  const [result, setResult] = useState<{ primary: MovieRecord; secondary?: MovieRecord } | null>(null);

  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);
  const genres = useMemo(() => unique(movies.flatMap((m) => getGenres(m))), [movies]);
  const sagas = useMemo(() => unique(movies.map((m) => m.saga)), [movies]);
  const directors = useMemo(() => unique(movies.map((m) => m.director)), [movies]);
  const tags = useMemo(() => unique(movies.map((m) => m.group)), [movies]);

  const filtered = useMemo(() => {
    return movies.filter((movie) => {
      const isSeries = Boolean(movie.series || movie.tmdbType === 'tv');
      if (contentType === 'movies' && isSeries) return false;
      if (contentType === 'series' && !isSeries) return false;

      if (selectedSections.length > 0 && !selectedSections.includes(movie.seccion)) return false;
      if (selectedSagas.length > 0 && !selectedSagas.includes(movie.saga)) return false;
      if (selectedDirectors.length > 0 && !selectedDirectors.includes(movie.director)) return false;
      if (selectedTags.length > 0 && !selectedTags.includes(movie.group)) return false;

      if (selectedGenres.length > 0) {
        const movieGenres = getGenres(movie);
        if (!selectedGenres.some((genre) => movieGenres.includes(genre))) return false;
      }

      if (!includeDamaged && movie.funcionaStatus === 'damaged') return false;

      if (onlyViewed) return movie.seen;
      if (excludeViewed) return !movie.seen;

      return true;
    });
  }, [
    movies,
    contentType,
    selectedSections,
    selectedGenres,
    selectedSagas,
    selectedDirectors,
    selectedTags,
    excludeViewed,
    onlyViewed,
    includeDamaged
  ]);

  const toggleValue = (value: string, current: string[], setCurrent: (next: string[]) => void) => {
    setResult(null);
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const pickRandom = (pool: MovieRecord[]) => pool[Math.floor(Math.random() * pool.length)];

  const pickRelated = (base: MovieRecord, pool: MovieRecord[]) => {
    const candidates = pool.filter((m) => m.id !== base.id);
    if (candidates.length === 0) return null;

    const sameSection = candidates.filter((m) => m.seccion === base.seccion);
    if (sameSection.length) return pickRandom(sameSection);

    const sameDirector = candidates.filter((m) => m.director === base.director);
    if (sameDirector.length) return pickRandom(sameDirector);

    const baseGenres = getGenres(base);
    const sameGenre = candidates.filter((m) => getGenres(m).some((genre) => baseGenres.includes(genre)));
    if (sameGenre.length) return pickRandom(sameGenre);

    return pickRandom(candidates);
  };

  const invoke = (isRespin = false) => {
    if (filtered.length === 0) return;
    if (!isRespin) setResult(null);
    setIsInvoking(true);
    setTimeout(() => {
      const primary = pickRandom(filtered);
      if (invocationMode === 'double') {
        const secondary = pickRelated(primary, filtered);
        setResult({ primary, secondary: secondary ?? undefined });
      } else {
        setResult({ primary });
      }
      setIsInvoking(false);
    }, 900);
  };

  const handleRespin = () => {
    if (isInvoking) return;
    invoke(true);
  };

  const handleClose = () => setResult(null);

  const handleMarkViewed = async (movie: MovieRecord) => {
    applyMovieStatusUpdate(movie.id, { seen: true });
    if (!adminSession) return;
    try {
      await updateMovieStatus({ collectionId: movie.id, seen: true });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        invoke();
      }
      if (event.key.toLowerCase() === 'r' && result) {
        event.preventDefault();
        handleRespin();
      }
      if (event.key === 'Escape' && result) {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, isInvoking, filtered, invocationMode]);

  useEffect(() => {
    if (onlyViewed) setExcludeViewed(false);
  }, [onlyViewed]);

  const renderCard = (movie: MovieRecord) => (
    <div className="surprise-result-card">
      <div className="surprise-result-poster">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
        ) : (
          <div className="surprise-result-placeholder">No poster</div>
        )}
      </div>
      <div className="surprise-result-info">
        <h3>{movie.title}</h3>
        <p className="muted">{movie.tmdbYear ?? movie.year ?? '?'} ? {movie.seccion}</p>
        <div className="surprise-result-actions">
          <button className="ghost" onClick={() => onSelect(movie)}>Open</button>
          <button className="ghost" onClick={handleRespin}>Respin</button>
          <button onClick={() => handleMarkViewed(movie)}>Mark Viewed</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`surprise-page ${isInvoking ? 'is-invoking' : ''}`}>
      <header className="surprise-hero">
        <h1>Surprise Movie Night</h1>
        <p className="surprise-subtitle">Let fate choose tonight's experience.</p>
      </header>

      <div className="surprise-segmented" role="tablist" aria-label="Content type">
        {(['movies', 'series', 'both'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={contentType === type ? 'is-active' : ''}
            onClick={() => setContentType(type)}
          >
            {type === 'movies' ? 'Movies' : type === 'series' ? 'Series' : 'Both'}
          </button>
        ))}
      </div>

      <div className="surprise-modes">
        <button
          type="button"
          className={`surprise-mode-card ${invocationMode === 'single' ? 'is-active' : ''}`}
          onClick={() => setInvocationMode('single')}
        >
          <h3>Single Feature</h3>
          <p>One random title</p>
        </button>
        <button
          type="button"
          className={`surprise-mode-card ${invocationMode === 'double' ? 'is-active' : ''}`}
          onClick={() => setInvocationMode('double')}
        >
          <h3>Double Feature</h3>
          <p>Two connected or contrasting titles</p>
        </button>
      </div>

      <div className="surprise-preferences">
        <button
          type="button"
          className="surprise-preferences__toggle"
          onClick={() => setPreferencesOpen((prev) => !prev)}
          aria-expanded={preferencesOpen}
        >
          Preferences {preferencesOpen ? '?' : '?'}
        </button>
        {preferencesOpen && (
          <div className="surprise-preferences__body">
            <div className="surprise-preferences__group">
              <h4>Section / Genre</h4>
              <div className="surprise-chip-grid">
                {sections.map((section) => (
                  <button
                    key={section}
                    type="button"
                    className={`surprise-chip ${selectedSections.includes(section) ? 'is-active' : ''}`}
                    onClick={() => toggleValue(section, selectedSections, setSelectedSections)}
                  >
                    {section}
                  </button>
                ))}
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={`surprise-chip ${selectedGenres.includes(genre) ? 'is-active' : ''}`}
                    onClick={() => toggleValue(genre, selectedGenres, setSelectedGenres)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
            <div className="surprise-preferences__group">
              <h4>Saga / Director / Tag</h4>
              <div className="surprise-chip-grid">
                {sagas.map((saga) => (
                  <button
                    key={saga}
                    type="button"
                    className={`surprise-chip ${selectedSagas.includes(saga) ? 'is-active' : ''}`}
                    onClick={() => toggleValue(saga, selectedSagas, setSelectedSagas)}
                  >
                    {saga}
                  </button>
                ))}
                {directors.map((director) => (
                  <button
                    key={director}
                    type="button"
                    className={`surprise-chip ${selectedDirectors.includes(director) ? 'is-active' : ''}`}
                    onClick={() => toggleValue(director, selectedDirectors, setSelectedDirectors)}
                  >
                    {director}
                  </button>
                ))}
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`surprise-chip ${selectedTags.includes(tag) ? 'is-active' : ''}`}
                    onClick={() => toggleValue(tag, selectedTags, setSelectedTags)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="surprise-preferences__group">
              <h4>Toggles</h4>
              <div className="surprise-toggles">
                <button
                  type="button"
                  className={`surprise-toggle ${excludeViewed ? 'is-active' : ''}`}
                  onClick={() => {
                    setExcludeViewed((prev) => !prev);
                    if (!excludeViewed) setOnlyViewed(false);
                  }}
                >
                  Exclude viewed
                </button>
                <button
                  type="button"
                  className={`surprise-toggle ${onlyViewed ? 'is-active' : ''}`}
                  onClick={() => setOnlyViewed((prev) => !prev)}
                >
                  Only viewed
                </button>
                <button
                  type="button"
                  className={`surprise-toggle ${includeDamaged ? 'is-active' : ''}`}
                  onClick={() => setIncludeDamaged((prev) => !prev)}
                >
                  Include damaged
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button className="surprise-invoke" type="button" onClick={() => invoke()} disabled={filtered.length === 0}>
        INVOKE FATE
      </button>

      {isInvoking && <div className="surprise-invoking">Summoning destiny...</div>}

      {result && (
        <div className={`surprise-results ${invocationMode === 'double' ? 'is-double' : ''}`}>
          {renderCard(result.primary)}
          {result.secondary && renderCard(result.secondary)}
        </div>
      )}
    </div>
  );
};
