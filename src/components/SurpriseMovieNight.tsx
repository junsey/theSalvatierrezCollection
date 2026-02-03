import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMovies } from '../context/MovieContext';
import { updateMovieStatus } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
}

const CONNECTION_TYPES = ['saga', 'director', 'actor', 'subgenre', 'decade', 'contrast'] as const;
type ConnectionType = (typeof CONNECTION_TYPES)[number];
type ConnectionResult = {
  movie: MovieRecord;
  type: ConnectionType | 'random';
  value: string;
  candidateCount: number;
};

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  saga: 'Same Saga',
  director: 'Same Director',
  actor: 'Shared Lead Actor',
  subgenre: 'Same Subgenre',
  decade: 'Same Decade',
  contrast: 'Contrast Pair'
};

const CONTRAST_MAP: Record<string, string> = {
  horror: 'comedy',
  comedy: 'horror',
  drama: 'action',
  action: 'drama',
  animation: 'live action',
  'live action': 'animation',
  'sci-fi': 'fantasy',
  fantasy: 'sci-fi',
  indie: 'blockbuster',
  blockbuster: 'indie'
};

const MOOD_SECTION_MAP: Record<string, string[]> = {
  Action: ['Acci?n', 'Action'],
  Horror: ['Horror', 'Terror'],
  Comedy: ['Comedia', 'Comedy'],
  Drama: ['Drama'],
  'Sci-Fi': ['Ciencia ficci?n', 'Sci-Fi', 'Sci Fi', 'Science Fiction'],
  Fantasy: ['Fantas?a', 'Fantasy'],
  Thriller: ['Thriller', 'Suspenso'],
  Animation: ['Animaci?n', 'Animation']
};

const MOOD_GENRES = ['Action', 'Horror', 'Comedy', 'Drama', 'Sci-Fi', 'Fantasy', 'Thriller', 'Animation'];

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

const getGenres = (movie: MovieRecord) => {
  const raw = movie.genreRaw ? movie.genreRaw.split(',').map((g) => g.trim()) : [];
  const tmdb = movie.tmdbGenres ?? [];
  return unique([...raw, ...tmdb]);
};


const normalizeGenre = (value: string) =>
  value
    .toLowerCase()
    .replace(/\./g, '')
    .replace('science fiction', 'sci-fi')
    .replace('sci fi', 'sci-fi');

const getActors = (movie: MovieRecord) => {
  const raw = (movie as MovieRecord & { actors?: string[]; cast?: string[]; tmdbActors?: string[] }).actors
    ?? (movie as MovieRecord & { actors?: string[]; cast?: string[]; tmdbActors?: string[] }).cast
    ?? (movie as MovieRecord & { actors?: string[]; cast?: string[]; tmdbActors?: string[] }).tmdbActors
    ?? [];
  return raw.filter(Boolean).slice(0, 5);
};

const getSubgenre = (movie: MovieRecord) => {
  const subgenre = (movie as MovieRecord & { subgenre?: string; subgenres?: string[] }).subgenre;
  if (subgenre) return subgenre;
  const list = (movie as MovieRecord & { subgenres?: string[] }).subgenres ?? [];
  return list[0] ?? null;
};

const getDecade = (year?: number | null) => {
  if (!year) return null;
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
};

const MultiSelect: React.FC<{
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}> = ({ label, options, values, onChange, placeholder = 'Search...' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return options;
    const needle = query.toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, query]);

  const toggleValue = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className={`surprise-select ${open ? 'is-open' : ''}`}>
      <button type="button" className="surprise-select__trigger" onClick={() => setOpen((prev) => !prev)}>
        <span>{label}</span>
        <span className="surprise-select__count">{values.length ? `${values.length} selected` : 'Any'}</span>
      </button>
      {open && (
        <div className="surprise-select__menu">
          <input
            className="surprise-select__search"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="surprise-select__options">
            {filtered.length === 0 && <span className="muted">No results</span>}
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                className={`surprise-select__option ${values.includes(option) ? 'is-active' : ''}`}
                onClick={() => toggleValue(option)}
              >
                <span>{option}</span>
                {values.includes(option) && <span aria-hidden>{'\u2713'}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const SurpriseMovieNight: React.FC<Props> = ({ movies, onSelect }) => {
  const { adminSession, applyMovieStatusUpdate } = useMovies();
  const [contentType, setContentType] = useState<'movies' | 'series' | 'both'>('movies');
  const [invocationMode, setInvocationMode] = useState<'single' | 'double'>('single');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedSubgenres, setSelectedSubgenres] = useState<string[]>([]);
  const [selectedSagas, setSelectedSagas] = useState<string[]>([]);
  const [selectedDirectors, setSelectedDirectors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [excludeViewed, setExcludeViewed] = useState(true);
  const [onlyViewed, setOnlyViewed] = useState(false);
  const [includeDamaged, setIncludeDamaged] = useState(false);
  const [isInvoking, setIsInvoking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const effectiveSections = useMemo(() => {
    const mapped = selectedMoods.flatMap((mood) => MOOD_SECTION_MAP[mood] ?? []);
    const all = [...mapped, ...selectedSections];
    return Array.from(new Set(all.filter(Boolean)));
  }, [selectedMoods, selectedSections]);

  const [result, setResult] = useState<{
    primary: MovieRecord;
    secondary?: MovieRecord;
    connectionType?: string;
    connectionValue?: string;
  } | null>(null);
  const connectionUsage = useRef<Record<(typeof CONNECTION_TYPES)[number], number>>({
    saga: 0,
    director: 0,
    actor: 0,
    subgenre: 0,
    decade: 0,
    contrast: 0
  });

  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);
  const genres = useMemo(() => unique(movies.flatMap((m) => getGenres(m))), [movies]);
  const sagas = useMemo(() => unique(movies.map((m) => m.saga)), [movies]);
  const directors = useMemo(() => unique(movies.map((m) => m.director)), [movies]);
  const tags = useMemo(() => unique(movies.map((m) => m.group)), [movies]);
  const decades = useMemo(
    () =>
      unique(
        movies
          .map((m) => getDecade(m.tmdbYear ?? m.year))
          .filter((value): value is string => Boolean(value))
      ),
    [movies]
  );

  const filtered = useMemo(() => {
    return movies.filter((movie) => {
      const isSeries = Boolean(movie.series || movie.tmdbType === 'tv');
      if (contentType === 'movies' && isSeries) return false;
      if (contentType === 'series' && !isSeries) return false;

      if (effectiveSections.length > 0 && !effectiveSections.includes(movie.seccion)) return false;

      if (selectedSagas.length > 0 && !selectedSagas.includes(movie.saga)) return false;
      if (selectedDirectors.length > 0 && !selectedDirectors.includes(movie.director)) return false;
      if (selectedTags.length > 0 && !selectedTags.includes(movie.group)) return false;

      if (selectedDecades.length > 0) {
        const decade = getDecade(movie.tmdbYear ?? movie.year);
        if (!decade || !selectedDecades.includes(decade)) return false;
      }

      const genreFilters = [...selectedMoods, ...selectedSubgenres];
      if (genreFilters.length > 0) {
        const movieGenres = getGenres(movie);
        if (!genreFilters.some((genre) => movieGenres.includes(genre))) return false;
      }

      if (!includeDamaged && movie.funcionaStatus === 'damaged') return false;

      if (onlyViewed) return movie.seen;
      if (excludeViewed) return !movie.seen;

      return true;
    });
  }, [
    movies,
    contentType,
    selectedMoods,
    selectedSections,
    effectiveSections,
    selectedSubgenres,
    selectedSagas,
    selectedDirectors,
    selectedTags,
    selectedDecades,
    excludeViewed,
    onlyViewed,
    includeDamaged
  ]);

  const samplePool = (pool: MovieRecord[], max = 200) => {
    if (pool.length <= max) return pool;
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, max);
  };

  const findConnection = (primary: MovieRecord, pool: MovieRecord[]): ConnectionResult | null => {
    const usage = connectionUsage.current;
    const minUsage = Math.min(...CONNECTION_TYPES.map((type) => usage[type]));
    const poolLimited = samplePool(pool.filter((movie) => movie.id !== primary.id));

    const attemptTypes = (allowed: (typeof CONNECTION_TYPES)[number][]) => {
      for (const type of allowed) {
        if (type === 'saga') {
          const saga = primary.saga?.trim();
          if (!saga) continue;
          const candidates = poolLimited.filter((movie) => movie.saga === saga);
          if (candidates.length) {
            return { movie: pickRandom(candidates), type, value: saga, candidateCount: candidates.length };
          }
        }

        if (type === 'director') {
          const director = primary.director?.trim();
          if (!director) continue;
          const candidates = poolLimited.filter((movie) => movie.director === director);
          if (candidates.length) {
            return { movie: pickRandom(candidates), type, value: director, candidateCount: candidates.length };
          }
        }

        if (type === 'actor') {
          const actors = getActors(primary);
          if (!actors.length) continue;
          const candidates = poolLimited.filter((movie) => {
            const candidateActors = getActors(movie);
            return actors.some((actor) => candidateActors.includes(actor));
          });
          if (candidates.length) {
            const selected = pickRandom(candidates);
            const shared = getActors(selected).find((actor) => actors.includes(actor)) ?? 'Shared Actor';
            return { movie: selected, type, value: shared, candidateCount: candidates.length };
          }
        }

        if (type === 'subgenre') {
          const subgenre = getSubgenre(primary);
          if (!subgenre) continue;
          const candidates = poolLimited.filter((movie) => getSubgenre(movie) === subgenre);
          if (candidates.length) {
            return { movie: pickRandom(candidates), type, value: subgenre, candidateCount: candidates.length };
          }
        }

        if (type === 'decade') {
          const decade = getDecade(primary.tmdbYear ?? primary.year);
          if (!decade) continue;
          const candidates = poolLimited.filter((movie) => getDecade(movie.tmdbYear ?? movie.year) === decade);
          if (candidates.length) {
            return { movie: pickRandom(candidates), type, value: decade, candidateCount: candidates.length };
          }
        }

        if (type === 'contrast') {
          const genres = getGenres(primary).map((genre) => normalizeGenre(genre));
          const matched = genres.find((genre) => CONTRAST_MAP[genre]);
          if (!matched) continue;
          const contrast = CONTRAST_MAP[matched];
          const candidates = poolLimited.filter((movie) => {
            const candidateGenres = getGenres(movie).map((genre) => normalizeGenre(genre));
            if (contrast === 'live action') return !candidateGenres.includes('animation');
            return candidateGenres.includes(contrast);
          });
          if (candidates.length) {
            const label = `${matched.replace('sci-fi', 'Sci-Fi')} ↔ ${contrast.replace('sci-fi', 'Sci-Fi')}`;
            return { movie: pickRandom(candidates), type, value: label, candidateCount: candidates.length };
          }
        }
      }
      return null;
    };

    const priorityTypes = CONNECTION_TYPES.filter((type) => usage[type] === minUsage);
    const secondaryTypes = CONNECTION_TYPES.filter((type) => usage[type] !== minUsage);
    const firstPass = attemptTypes(priorityTypes);
    if (firstPass) return firstPass;
    const secondPass = attemptTypes(secondaryTypes);
    if (secondPass) return secondPass;

    const fallback = poolLimited.filter((movie) => movie.seccion === primary.seccion);
    if (fallback.length) {
      return { movie: pickRandom(fallback), type: 'random', value: 'Random Pair', candidateCount: fallback.length };
    }
    return null;
  };

  const toggleValue = (value: string, current: string[], setCurrent: (next: string[]) => void) => {
    setResult(null);
    setMessage(null);
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const updateSections = (next: string[]) => {
    setSelectedSections(next);
    setResult(null);
    setMessage(null);
  };

  const updateDirectors = (next: string[]) => {
    setSelectedDirectors(next);
    setResult(null);
    setMessage(null);
  };

  const updateSagas = (next: string[]) => {
    setSelectedSagas(next);
    setResult(null);
    setMessage(null);
  };


  const pickRandom = (pool: MovieRecord[]) => pool[Math.floor(Math.random() * pool.length)];

  const invoke = (isRespin = false, lockedPrimary?: MovieRecord | null) => {
    const query = {
      contentType,
      mode: invocationMode,
      selectedMoods,
      selectedSections,
      selectedDirectors,
      selectedSagas,
      toggles: {
        excludeViewed,
        onlyViewed,
        includeDamaged
      },
      effectiveSections
    };

    if (import.meta.env.DEV) {
      console.log('[Invoke Fate]', {
        contentType,
        mode: invocationMode,
        selectedMoodChips: selectedMoods,
        selectedSections,
        selectedDirectors,
        selectedSagas,
        toggles: { excludeViewed, onlyViewed, includeDamaged },
        query,
        candidateCount: filtered.length
      });
    }

    if (filtered.length === 0) {
      setMessage('No results match your current preferences.');
      setResult(null);
      return;
    }

    if (!isRespin) {
      setResult(null);
      setMessage(null);
    }

    setIsInvoking(true);
    setTimeout(() => {
      const primary = lockedPrimary ?? pickRandom(filtered);
      if (!primary) {
        setIsInvoking(false);
        setMessage('No results match your current preferences.');
        return;
      }
      if (invocationMode === 'double') {
        const connection = findConnection(primary, filtered);
        if (connection) {
          const connectionTypeLabel =
            connection.type === 'random' ? 'Random Pair' : CONNECTION_LABELS[connection.type];
          if (connection.type !== 'random') {
            connectionUsage.current[connection.type] += 1;
          }
          if (import.meta.env.DEV) {
            console.log('[Surprise Double Feature]', {
              movieA: primary.id,
              connectionType: connectionTypeLabel,
              candidates: connection.candidateCount,
              movieB: connection.movie.id
            });
          }
          setResult({
            primary,
            secondary: connection.movie,
            connectionType: connectionTypeLabel,
            connectionValue: connection.value
          });
        } else {
          setResult({ primary });
        }
      } else {
        setResult({ primary });
      }
      setIsInvoking(false);
    }, 900);
  };

  const handleRespin = () => {
    if (isInvoking) return;
    if (result?.secondary && invocationMode === 'double') {
      invoke(true, result.primary);
      return;
    }
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
        <p className="muted">
          {movie.tmdbYear ?? movie.year ?? '?'} ? {movie.seccion}
        </p>
        <div className="surprise-result-actions">
          <button className="ghost" onClick={() => onSelect(movie)}>
            Open
          </button>
          <button className="ghost" onClick={handleRespin}>
            Respin
          </button>
          <button onClick={() => handleMarkViewed(movie)}>
            <span aria-hidden>{'\u2713'}</span> Mark Viewed
          </button>
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
              <h4>Mood</h4>
              <div className="surprise-chip-grid surprise-chip-grid--large">
                {MOOD_GENRES.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    className={`surprise-chip ${selectedMoods.includes(mood) ? 'is-active' : ''}`}
                    onClick={() => toggleValue(mood, selectedMoods, setSelectedMoods)}
                  >
                    {mood}
                  </button>
                ))}
                <MultiSelect
                  label="+ More?"
                  options={sections}
                  values={selectedSections}
                  onChange={updateSections}
                  placeholder="Search sections"
                />
              </div>
              {selectedSections.length > 0 && (
                <div className="surprise-extra">
                  <span>Additional sections: {selectedSections.length} selected</span>
                  <button type="button" onClick={() => setSelectedSections([])}>Clear</button>
                </div>
              )}
            </div>
            <div className="surprise-preferences__group">
              <h4>Collections</h4>
              <div className="surprise-preferences__row">
                <MultiSelect
                  label="Directors"
                  options={directors}
                  values={selectedDirectors}
                  onChange={updateDirectors}
                  placeholder="Search directors"
                />
                <MultiSelect
                  label="Sagas"
                  options={sagas}
                  values={selectedSagas}
                  onChange={updateSagas}
                  placeholder="Search sagas"
                />
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
            <div className="surprise-preferences__group">
              <button
                type="button"
                className="surprise-advanced__toggle"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                aria-expanded={advancedOpen}
              >
                Advanced {advancedOpen ? '?' : '?'}
              </button>
              {advancedOpen && (
                <div className="surprise-advanced__body">
                  <div className="surprise-preferences__subgroup">
                    <h5>Subgenres</h5>
                    <div className="surprise-chip-grid">
                      {genres.map((genre) => (
                        <button
                          key={genre}
                          type="button"
                          className={`surprise-chip ${selectedSubgenres.includes(genre) ? 'is-active' : ''}`}
                          onClick={() => toggleValue(genre, selectedSubgenres, setSelectedSubgenres)}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="surprise-preferences__subgroup">
                    <h5>Decades</h5>
                    <div className="surprise-chip-grid">
                      {decades.map((decade) => (
                        <button
                          key={decade}
                          type="button"
                          className={`surprise-chip ${selectedDecades.includes(decade) ? 'is-active' : ''}`}
                          onClick={() => toggleValue(decade, selectedDecades, setSelectedDecades)}
                        >
                          {decade}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="surprise-preferences__subgroup">
                    <h5>Tags</h5>
                    <div className="surprise-chip-grid">
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
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button className="surprise-invoke" type="button" onClick={() => invoke()} disabled={filtered.length === 0}>
        INVOKE FATE
      </button>

      {isInvoking && <div className="surprise-invoking">Summoning destiny...</div>}

      {message && <div className="surprise-message">{message}</div>}

      {result && (
        <div className={`surprise-results ${invocationMode === 'double' ? 'is-double' : ''}`}>
          {renderCard(result.primary)}
          {result.secondary && (
            <div className="surprise-connection-badge">
              <span aria-hidden>🔗</span>
              <span>
                {result.connectionType}
                {result.connectionValue ? `: ${result.connectionValue}` : ''}
              </span>
            </div>
          )}
          {result.secondary && renderCard(result.secondary)}
        </div>
      )}
    </div>
  );
};
