import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMovies } from '../context/MovieContext';
import { updateMovieStatus } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
}

const CONNECTION_TYPES = ['saga', 'director', 'actor', 'subgenre', 'contrast', 'decade'] as const;
type ConnectionType = (typeof CONNECTION_TYPES)[number];
type ConnectionResult = {
  movie: MovieRecord;
  type: ConnectionType | 'random';
  value: string;
  candidateCount: number;
};

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  saga: 'Same Saga / Franchise',
  director: 'Same Director',
  actor: 'Same Actor / Cast',
  subgenre: 'Same Genre',
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

const normalizeToken = (value: string) => value.trim().toLowerCase();

const splitList = (value?: string | null) =>
  value
    ? value
        .split(/[,&]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

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
        <span className="surprise-select__label">{label}</span>
        <span className="surprise-select__count">{values.length ? `${values.length} selected` : 'Any'}</span>
        <span className="surprise-select__action">Choose</span>
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
                {values.includes(option) && <span aria-hidden>&#10003;</span>}
              </button>
            ))}
          </div>
          <div className="surprise-select__footer">
            {values.length > 0 && (
              <button type="button" className="surprise-select__clear" onClick={() => onChange([])}>
                Clear
              </button>
            )}
            <button type="button" className="surprise-select__done" onClick={() => setOpen(false)}>
              Done
            </button>
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
  const [connectionPreference, setConnectionPreference] = useState<'random' | ConnectionType>('random');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    contrast: 0,
    decade: 0
  });
  const recentConnections = useRef<ConnectionType[]>([]);

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

  const connectionOptions: { value: 'random' | ConnectionType; label: string }[] = [
    { value: 'random', label: 'Random' },
    { value: 'director', label: 'Same Director' },
    { value: 'actor', label: 'Same Actor / Cast' },
    { value: 'saga', label: 'Same Saga / Franchise' },
    { value: 'decade', label: 'Same Decade' },
    { value: 'subgenre', label: 'Same Genre' },
    { value: 'contrast', label: 'Contrast Pair' }
  ];
  const filtered = useMemo(() => {
    return movies.filter((movie) => {
      const isSeries = Boolean(movie.series || movie.tmdbType === 'tv');
      if (contentType === 'movies' && isSeries) return false;
      if (contentType === 'series' && !isSeries) return false;

      if (selectedSections.length > 0 && !selectedSections.includes(movie.seccion)) return false;

      if (selectedSagas.length > 0 && !selectedSagas.includes(movie.saga)) return false;
      if (selectedDirectors.length > 0 && !selectedDirectors.includes(movie.director)) return false;
      if (selectedTags.length > 0 && !selectedTags.includes(movie.group)) return false;

      if (selectedDecades.length > 0) {
        const decade = getDecade(movie.tmdbYear ?? movie.year);
        if (!decade || !selectedDecades.includes(decade)) return false;
      }

      const genreFilters = [...selectedSubgenres];
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
    selectedSections,
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

  const findConnection = (primary: MovieRecord, pool: MovieRecord[], forcedType?: ConnectionType | null): ConnectionResult | null => {
    const usage = connectionUsage.current;
    const recent = recentConnections.current;
    const recentCounts = recent.reduce<Record<ConnectionType, number>>(
      (acc, type) => ({ ...acc, [type]: (acc[type] ?? 0) + 1 }),
      { saga: 0, director: 0, actor: 0, subgenre: 0, contrast: 0, decade: 0 }
    );
    const basePool = pool.filter((movie) => movie.id !== primary.id);
    const poolLimited = forcedType ? basePool : samplePool(basePool);

    const scored = CONNECTION_TYPES.map((type, index) => {
      const recentPenalty = (recentCounts[type] ?? 0) * 10;
      const decadePenalty = type === 'decade' ? 20 : 0;
      return { type, score: index + recentPenalty + decadePenalty + usage[type] };
    }).sort((a, b) => a.score - b.score);

    const attemptTypes = (allowed: ConnectionType[]) => {
      for (const type of allowed) {
        if (type === 'saga') {
          const saga = primary.saga?.trim();
          if (!saga) continue;
          const normalizedSaga = normalizeToken(saga);
          const candidates = poolLimited.filter((movie) => normalizeToken(movie.saga ?? '') === normalizedSaga);
          if (candidates.length) {
            return { movie: pickRandom(candidates), type, value: saga, candidateCount: candidates.length };
          }
        }
        if (type === 'director') {
          const directors = splitList(primary.director).map((name) => normalizeToken(name));
          if (!directors.length) continue;
          const candidates = poolLimited.filter((movie) => {
            const candidateDirectors = splitList(movie.director).map((name) => normalizeToken(name));
            return directors.some((name) => candidateDirectors.includes(name));
          });
          if (candidates.length) {
            const selected = pickRandom(candidates);
            const selectedDirectors = splitList(selected.director);
            const shared = selectedDirectors.find((name) =>
              directors.includes(normalizeToken(name))
            ) ?? selectedDirectors[0] ?? 'Shared Director';
            return { movie: selected, type, value: shared, candidateCount: candidates.length };
          }
        }
        if (type === 'actor') {
          const actors = getActors(primary).map((actor) => normalizeToken(actor));
          if (!actors.length) continue;
          const candidates = poolLimited.filter((movie) => {
            const candidateActors = getActors(movie).map((actor) => normalizeToken(actor));
            return actors.some((actor) => candidateActors.includes(actor));
          });
          if (candidates.length) {
            const selected = pickRandom(candidates);
            const shared = getActors(selected).find((actor) =>
              actors.includes(normalizeToken(actor))
            ) ?? 'Shared Actor';
            return { movie: selected, type, value: shared, candidateCount: candidates.length };
          }
        }

        if (type === 'subgenre') {
          const genres = getGenres(primary).map((genre) => normalizeToken(genre));
          if (!genres.length) continue;
          const candidates = poolLimited.filter((movie) => {
            const candidateGenres = getGenres(movie).map((genre) => normalizeToken(genre));
            return genres.some((genre) => candidateGenres.includes(genre));
          });
          if (candidates.length) {
            const selected = pickRandom(candidates);
            const shared = getGenres(selected).find((genre) =>
              genres.includes(normalizeToken(genre))
            ) ?? 'Shared Genre';
            return { movie: selected, type, value: shared, candidateCount: candidates.length };
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
            const label = `${matched.replace('sci-fi', 'Sci-Fi')} â ${contrast.replace('sci-fi', 'Sci-Fi')}`;
            return { movie: pickRandom(candidates), type, value: label, candidateCount: candidates.length };
          }
        }
      }
      return null;
    };

    if (forcedType) {
      return attemptTypes([forcedType]);
    }

    const orderedTypes = scored.map((entry) => entry.type);
    const firstPass = attemptTypes(orderedTypes);
    if (firstPass) return firstPass;

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
      selectedSections,
      selectedDirectors,
      selectedSagas,
      toggles: {
        excludeViewed,
        onlyViewed,
        includeDamaged
      }
    };

    if (import.meta.env.DEV) {
      console.log('[Invoke Fate]', {
        contentType,
        mode: invocationMode,
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
        const forcedType = connectionPreference !== 'random' ? connectionPreference : null;
        const forcedConnection = forcedType ? findConnection(primary, filtered, forcedType) : null;
        if (!forcedConnection && forcedType) {
          setMessage('No second title found with this connection. Trying random.');
        }
        const connection = forcedConnection ?? findConnection(primary, filtered);
        if (connection) {
          const connectionTypeLabel =
            connection.type === 'random' ? 'Random Pair' : CONNECTION_LABELS[connection.type];
          if (connection.type !== 'random') {
            connectionUsage.current[connection.type] += 1;
            recentConnections.current = [
              connection.type,
              ...recentConnections.current
            ].slice(0, 10);
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
  const renderCard = (movie: MovieRecord) => {
    const year = movie.tmdbYear ?? movie.year ?? null;
    const genre = getGenres(movie)[0] ?? null;
    const section = movie.seccion ?? null;
    const metadataParts = [
      year ? String(year) : null,
      genre ? `Genre: ${genre}` : null,
      section ? `Section: ${section}` : null
    ].filter(Boolean);
    const metadata = metadataParts.join('  ');
    const directorList = (movie.director ?? '')
      .split(/[,&]/)
      .map((d) => d.trim())
      .filter(Boolean);
    const directorText = directorList.length ? `Director: ${directorList.join(', ')}` : null;
    const knownAuthors = new Set(['Stephen King']);
    const basedOnSource = [movie.group, movie.seccion].find((value) => knownAuthors.has(value?.trim?.() ?? ''));
    const basedOnText = basedOnSource ? `Based on: ${basedOnSource}` : null;
    const synopsis = movie.plot?.trim();

    return (
      <div className="surprise-result-hero">
        <div className="surprise-result-hero__poster">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
          ) : (
            <div className="surprise-result-hero__placeholder">No poster</div>
          )}
        </div>
        <div className="surprise-result-hero__info">
          <h3>{movie.title}</h3>
          {metadata && <p className="surprise-result-hero__meta">{metadata}</p>}
          {basedOnText && <p className="surprise-result-hero__based">{basedOnText}</p>}
          {directorText && <p className="surprise-result-hero__director">{directorText}</p>}
          {synopsis && (
            <div className="surprise-result-hero__synopsis-wrap">
              <p className="surprise-result-hero__synopsis">{synopsis}</p>
            
            </div>
          )}
          <div className="surprise-result-hero__actions">
            <div className="surprise-result-hero__action-bar">
              <button className="ghost" onClick={() => onSelect(movie)}>
                Open
              </button>
              {adminSession && (
                <button onClick={() => handleMarkViewed(movie)}>
                  <span aria-hidden>&#10003;</span> Mark Viewed
                </button>
              )}
            </div>
            {!adminSession && (
              <span className="surprise-result-hero__hint">Sign in to track viewed</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`surprise-page ${isInvoking ? 'is-invoking' : ''}`}>
      <header className="surprise-header">
        <h1 className="surprise-header__title">Surprise Movie Night</h1>
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
          Preferences
        </button>
        {preferencesOpen && (
          <div className="surprise-preferences__body">
            <div className="surprise-preferences__group">
              <h4>Sections</h4>
              <MultiSelect
                label="Sections"
                options={sections}
                values={selectedSections}
                onChange={updateSections}
                placeholder="Search sections"
              />
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
            {invocationMode === 'double' && (
              <div className="surprise-preferences__group">
                <h4>Double Feature Connection</h4>
                <p className="surprise-preferences__helper">Choose how the two films are connected.</p>
                <div className="surprise-toggles">
                  {connectionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`surprise-toggle ${connectionPreference === option.value ? 'is-active' : ''}`}
                      onClick={() => {
                        setConnectionPreference(option.value);
                        setResult(null);
                        setMessage(null);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                Advanced
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

      <div className="surprise-invoke-row">
        <button className="surprise-invoke" type="button" onClick={() => invoke()} disabled={filtered.length === 0}>
          INVOKE FATE
        </button>
        <button
          className="surprise-reroll"
          type="button"
          onClick={handleRespin}
          disabled={!result || isInvoking}
        >
          REROLL
        </button>
      </div>

      {isInvoking && <div className="surprise-invoking">Summoning destiny...</div>}

      {message && <div className="surprise-message">{message}</div>}

      {result && (
        <div className="surprise-results">
          {renderCard(result.primary)}
          {result.secondary && (
            <div className="surprise-connection-separator" role="presentation">
              <span className="surprise-connection-separator__line" />
              <div className="surprise-connection-separator__label">
                <span aria-hidden>&#128279;</span>
                <span>
                  {(result.connectionType ?? '').toUpperCase()}
                  {result.connectionValue ? ` · ${result.connectionValue.toUpperCase()}` : ''}
                </span>
              </div>
              <span className="surprise-connection-separator__line" />
            </div>
          )}
          {result.secondary && renderCard(result.secondary)}
        </div>
      )}
    </div>
  );
};
































































