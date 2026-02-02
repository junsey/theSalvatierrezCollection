import React, { useEffect, useMemo, useState } from 'react';
import { useMovies } from '../context/MovieContext';
import { updateMovieStatus } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
  excludeSeenDefault?: boolean;
}

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

export const SurpriseMovieNight: React.FC<Props> = ({ movies, onSelect, excludeSeenDefault = true }) => {
  const { adminSession, applyMovieStatusUpdate } = useMovies();
  const MAX_REROLLS = 3;
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [excludeSeen, setExcludeSeen] = useState(excludeSeenDefault);
  const [ritualType, setRitualType] = useState<'movies' | 'series'>('movies');
  const [seriesMode, setSeriesMode] = useState<'new' | 'started'>('new');
  const [chosen, setChosen] = useState<MovieRecord | null>(null);
  const [chosenSeries, setChosenSeries] = useState<{
    series: MovieRecord;
    episode?: NonNullable<MovieRecord['seriesEpisodes']>[number] | null;
  } | null>(null);
  const [doubleFeature, setDoubleFeature] = useState<{
    active: MovieRecord;
    secondary: MovieRecord;
    position: 'left' | 'right';
    link: string;
  } | null>(null);
  const [isSummoning, setIsSummoning] = useState(false);
  const [rerollsLeft, setRerollsLeft] = useState(MAX_REROLLS);
  const [statusInputs, setStatusInputs] = useState<
    Record<string, { seen: boolean; ratingGloria: string; ratingRodrigo: string; busy?: boolean; error?: string }>
  >({});

  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const sectionMatch = selectedSections.length === 0 || selectedSections.includes(m.seccion);
      if (!sectionMatch) return false;
      if (ritualType === 'movies') {
        const seenMatch = excludeSeen ? !m.seen : true;
        const seriesMatch = !m.series;
        return seenMatch && seriesMatch;
      }
      const seenMatch = excludeSeen ? !m.seen : true;
      const isSeries = m.series || m.tmdbType === 'tv';
      if (!isSeries) return false;
      const episodes = m.seriesEpisodes ?? [];
      const hasSeenEpisodes = episodes.some((episode) => episode.seen);
      const hasUnseenEpisodes = episodes.some((episode) => !episode.seen);
      const modeMatch = seriesMode === 'new'
        ? !hasSeenEpisodes
        : hasSeenEpisodes && hasUnseenEpisodes;
      return seenMatch && modeMatch;
    });
  }, [movies, selectedSections, excludeSeen, ritualType, seriesMode]);

  const toggleSection = (section: string) => {
    setDoubleFeature(null);
    setChosen(null);
    setChosenSeries(null);
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const toggleAllSections = () => {
    setDoubleFeature(null);
    setChosen(null);
    setChosenSeries(null);
    setSelectedSections((prev) => (prev.length === sections.length ? [] : sections));
  };

  const pickSeriesEpisode = (series: MovieRecord) => {
    const episodes = series.seriesEpisodes ?? [];
    if (episodes.length === 0) return null;
    const sorted = [...episodes].sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    if (seriesMode === 'started') {
      const unseen = sorted.filter((episode) => !episode.seen);
      if (unseen.length === 0) return null;
      return unseen[Math.floor(Math.random() * unseen.length)];
    }
    return sorted[0];
  };

  const summon = (isReroll = false) => {
    if (filtered.length === 0) {
      setChosen(null);
      setDoubleFeature(null);
      setChosenSeries(null);
      return;
    }
    if (!isReroll) {
      setRerollsLeft(MAX_REROLLS);
    }
    setIsSummoning(true);
    setTimeout(() => {
      const random = filtered[Math.floor(Math.random() * filtered.length)];
      if (ritualType === 'series') {
        setChosenSeries({ series: random, episode: pickSeriesEpisode(random) });
        setChosen(null);
        setDoubleFeature(null);
      } else {
        setChosen(random);
        setDoubleFeature(null);
        setChosenSeries(null);
      }
      setIsSummoning(false);
    }, 1200);
  };

  const pickRelated = (base: MovieRecord) => {
    const pool = filtered.filter((m) => m.id !== base.id);
    if (pool.length === 0) return null;

    const sectionMatches = pool.filter((m) => m.seccion === base.seccion);
    if (sectionMatches.length) {
      return {
        movie: sectionMatches[Math.floor(Math.random() * sectionMatches.length)],
        link: `Sección: ${base.seccion}`
      };
    }

    const directorMatches = pool.filter((m) => m.director === base.director);
    if (directorMatches.length) {
      return {
        movie: directorMatches[Math.floor(Math.random() * directorMatches.length)],
        link: `Director: ${base.director}`
      };
    }

    const sharedGenre = (first: MovieRecord, candidate: MovieRecord) => {
      const baseGenres = first.tmdbGenres ?? first.genreRaw?.split(',').map((g) => g.trim()) ?? [];
      const candidateGenres = candidate.tmdbGenres ?? candidate.genreRaw?.split(',').map((g) => g.trim()) ?? [];
      const match = baseGenres.find((g) => candidateGenres.includes(g));
      return match ?? null;
    };

    const genreMatches = pool
      .map((movie) => ({ movie, match: sharedGenre(base, movie) }))
      .filter((entry): entry is { movie: MovieRecord; match: string } => Boolean(entry.match));
    if (genreMatches.length) {
      const selected = genreMatches[Math.floor(Math.random() * genreMatches.length)];
      return {
        movie: selected.movie,
        link: `Género: ${selected.match}`
      };
    }

    return {
      movie: pool[Math.floor(Math.random() * pool.length)],
      link: 'Selección afinada'
    };
  };

  const summonDoubleFeature = (isReroll = false) => {
    if (ritualType === 'series') {
      summon(isReroll);
      return;
    }
    if (filtered.length === 0) {
      setChosen(null);
      setDoubleFeature(null);
      setChosenSeries(null);
      return;
    }

    if (!isReroll) {
      setRerollsLeft(MAX_REROLLS);
    }
    setIsSummoning(true);
    setTimeout(() => {
      const primary = filtered[Math.floor(Math.random() * filtered.length)];
      const secondaryResult = pickRelated(primary);

      if (!secondaryResult) {
        setChosen(primary);
        setDoubleFeature(null);
        setChosenSeries(null);
        setIsSummoning(false);
        return;
      }

      setChosen(null);
      setDoubleFeature({
        active: primary,
        secondary: secondaryResult.movie,
        position: 'right',
        link: secondaryResult.link
      });
      setChosenSeries(null);
      setIsSummoning(false);
    }, 1200);
  };

  const swapDoubleFeature = () => {
    setDoubleFeature((current) => {
      if (!current) return current;
      return {
        active: current.secondary,
        secondary: current.active,
        position: current.position === 'right' ? 'left' : 'right',
        link: current.link
      };
    });
  };

  useEffect(() => {
    const hasResult = Boolean(chosen || doubleFeature || chosenSeries);
    const shouldLock = isSummoning || hasResult;
    if (!shouldLock) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [chosen, doubleFeature, chosenSeries, isSummoning]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (chosen || doubleFeature || chosenSeries) {
        setChosen(null);
        setDoubleFeature(null);
        setChosenSeries(null);
        setRerollsLeft(MAX_REROLLS);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chosen, doubleFeature, chosenSeries]);

  useEffect(() => {
    const targets = [chosen, doubleFeature?.active, doubleFeature?.secondary].filter(Boolean) as MovieRecord[];
    if (targets.length === 0) return;
    setStatusInputs((prev) => {
      const next = { ...prev };
      targets.forEach((movie) => {
        if (next[movie.id]) return;
        next[movie.id] = {
          seen: true,
          ratingGloria: movie.ratingGloria != null ? String(movie.ratingGloria) : '',
          ratingRodrigo: movie.ratingRodrigo != null ? String(movie.ratingRodrigo) : ''
        };
      });
      return next;
    });
  }, [chosen, doubleFeature]);

  const updateStatusField = (movieId: string, field: 'seen' | 'ratingGloria' | 'ratingRodrigo', value: string | boolean) => {
    setStatusInputs((prev) => ({
      ...prev,
      [movieId]: {
        ...prev[movieId],
        [field]: value
      }
    }));
  };

  const handleSaveStatus = async (movie: MovieRecord) => {
    const input = statusInputs[movie.id];
    if (!input) return;
    setStatusInputs((prev) => ({
      ...prev,
      [movie.id]: { ...input, busy: true, error: undefined }
    }));
    try {
      const ratingGloria = input.ratingGloria ? Number(input.ratingGloria) : null;
      const ratingRodrigo = input.ratingRodrigo ? Number(input.ratingRodrigo) : null;
      await updateMovieStatus({
        collectionId: movie.id,
        seen: input.seen,
        ratingGloria,
        ratingRodrigo
      });
      applyMovieStatusUpdate(movie.id, { seen: input.seen, ratingGloria, ratingRodrigo });
      setStatusInputs((prev) => ({
        ...prev,
        [movie.id]: { ...input, busy: false, error: undefined }
      }));
    } catch (error) {
      console.error(error);
      setStatusInputs((prev) => ({
        ...prev,
        [movie.id]: { ...input, busy: false, error: 'No se pudo guardar.' }
      }));
    }
  };

  const handleCloseResults = () => {
    setChosen(null);
    setDoubleFeature(null);
    setChosenSeries(null);
    setRerollsLeft(MAX_REROLLS);
  };

  const handleReroll = () => {
    if (isSummoning || rerollsLeft <= 0) return;
    setRerollsLeft((prev) => Math.max(0, prev - 1));
    if (doubleFeature) {
      summonDoubleFeature(true);
    } else {
      summon(true);
    }
  };

  const renderPoster = (movie: MovieRecord, className?: string) => (
    <div className={className ?? 'feature-poster-frame'} aria-hidden={!movie.posterUrl}>
      {movie.posterUrl ? (
        <img className="feature-poster" src={movie.posterUrl} alt={`Póster de ${movie.title}`} loading="lazy" />
      ) : (
        <div className="feature-poster placeholder">Sin póster</div>
      )}
    </div>
  );


  const renderAdminControls = (movie: MovieRecord) => {
    if (!adminSession) return null;
    const input = statusInputs[movie.id];
    return (
      <details className="ritual-admin">
        <summary>Marcar como vista</summary>
        <div className="ritual-admin__body">
          <label className="ritual-admin__check">
            <input
              type="checkbox"
              checked={input?.seen ?? true}
              onChange={(event) => updateStatusField(movie.id, 'seen', event.target.checked)}
            />
            <span>Vista</span>
          </label>
          <div className="ritual-admin__ratings">
            <label>
              <span>Gloria</span>
              <input
                type="number"
                step="0.5"
                value={input?.ratingGloria ?? ''}
                onChange={(event) => updateStatusField(movie.id, 'ratingGloria', event.target.value)}
              />
            </label>
            <label>
              <span>Rodrigo</span>
              <input
                type="number"
                step="0.5"
                value={input?.ratingRodrigo ?? ''}
                onChange={(event) => updateStatusField(movie.id, 'ratingRodrigo', event.target.value)}
              />
            </label>
          </div>
          <button className="btn" onClick={() => handleSaveStatus(movie)} disabled={input?.busy}>
            {input?.busy ? 'Guardando...' : 'Guardar'}
          </button>
          {input?.error && <p className="ritual-admin__error">{input.error}</p>}
        </div>
      </details>
    );
  };

  const ritualLabel = ritualType === 'series' ? 'Surprise Series Night' : 'Surprise Movie Night';

  return (
    <div className="ritual-panel">
      <header className="ritual-panel__header">
        <div className="ritual-panel__heading">
          <h2>Surprise Movie Night</h2>
          <p className="ritual-panel__subtitle">Ritual configuration</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="muted">Invocar</span>
            <select
              value={ritualType}
              onChange={(event) => {
                setRitualType(event.target.value as 'movies' | 'series');
                setChosen(null);
                setDoubleFeature(null);
                setChosenSeries(null);
              }}
            >
              <option value="movies">Películas</option>
              <option value="series">Series</option>
            </select>
          </label>
          {ritualType === 'series' && (
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Estado</span>
              <select
                value={seriesMode}
                onChange={(event) => {
                  setSeriesMode(event.target.value as 'new' | 'started');
                  setChosen(null);
                  setDoubleFeature(null);
                  setChosenSeries(null);
                }}
              >
                <option value="new">Nueva</option>
                <option value="started">Empezada</option>
              </select>
            </label>
          )}
        </div>
        <button
          className={`toggle-control ritual-panel__toggle ${excludeSeen ? 'on' : ''}`}
          onClick={() => setExcludeSeen((prev) => !prev)}
          type="button"
        >
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">
            {ritualType === 'series' ? 'Excluir series vistas' : 'Excluir vistas'}
          </span>
        </button>
      </header>

      <section className="ritual-flow">
        <div className="ritual-selector">
          <div className="section-pills ritual-selector__pills">
            <button
              className={`pill ${selectedSections.length === sections.length && sections.length > 0 ? 'active' : ''}`}
              onClick={toggleAllSections}
              type="button"
            >
              Todas
            </button>
            {sections.map((section) => (
              <button
                key={section}
                className={`pill ${selectedSections.includes(section) ? 'active' : ''}`}
                onClick={() => toggleSection(section)}
                type="button"
              >
                {section}
              </button>
            ))}
          </div>
        </div>
        <div className="random-actions ritual-actions">
          <button onClick={() => summon()} className="action-large">
            Summon
          </button>
          {ritualType === 'movies' && (
            <button onClick={() => summonDoubleFeature()} className="action-large secondary">
              Double Summon
            </button>
          )}
        </div>
        {filtered.length === 0 && (
          <p className="muted">
            {ritualType === 'series'
              ? 'No hay series para invocar con estos filtros.'
              : 'No hay películas para invocar con estos filtros.'}
          </p>
        )}
      </section>

      {isSummoning && (
        <div className="ritual-invocation">
          <div className="ritual-invocation__glow" aria-hidden />
          <p>Barajando la colección…</p>
        </div>
      )}

      {(chosen || doubleFeature || chosenSeries) && (
        <div
          className="detail-sheet__overlay surprise-detail__overlay"
          role="dialog"
          aria-label="Resultados de Surprise Night"
          onClick={handleCloseResults}
        >
          <div
            className="detail-sheet surprise-detail"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`detail-sheet__inner surprise-detail__inner ${doubleFeature ? 'surprise-detail__inner--double' : ''}`}>
              {doubleFeature && (
                <div
                  className="detail-sheet__hero-backdrop surprise-detail__backdrop"
                  style={{
                    backgroundImage: `url(${doubleFeature.active.posterUrl ?? ''})`
                  }}
                  aria-hidden
                />
              )}
              <header className="surprise-detail__hero">
                {chosen && (
                  <div
                    className="detail-sheet__hero-backdrop"
                    style={{
                      backgroundImage: `url(${chosen.posterUrl ?? ''})`
                    }}
                    aria-hidden
                  />
                )}
                {chosenSeries && (
                  <div
                    className="detail-sheet__hero-backdrop"
                    style={{
                      backgroundImage: `url(${chosenSeries.series.posterUrl ?? ''})`
                    }}
                    aria-hidden
                  />
                )}
                <div className="surprise-detail__hero-content">
                  <div className="surprise-detail__titles">
                    <p className="eyebrow">{ritualLabel}</p>
                    <h2>{doubleFeature ? 'REVELACIÓN DOBLE' : 'Revelación'}</h2>
                  </div>
                  <div className="surprise-detail__actions">
                    {chosen && <button onClick={() => onSelect(chosen)}>Abrir detalles</button>}
                    {chosenSeries && <button onClick={() => onSelect(chosenSeries.series)}>Abrir detalles</button>}
                    {doubleFeature && (
                      <button onClick={() => onSelect(doubleFeature.active)}>Abrir detalles</button>
                    )}
                    <button onClick={handleReroll} disabled={isSummoning || rerollsLeft <= 0}>
                      Reroll Summon{' '}
                      <span
                        aria-label={`Intentos restantes: ${rerollsLeft}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 22,
                          height: 22,
                          marginLeft: 8,
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(0,0,0,0.35)',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {rerollsLeft}
                      </span>
                    </button>
                    <button
                      className="ghost"
                      onClick={handleCloseResults}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
                {chosen && <div className="surprise-detail__poster">{renderPoster(chosen)}</div>}
                {chosenSeries && <div className="surprise-detail__poster">{renderPoster(chosenSeries.series)}</div>}
              </header>
              <div className="surprise-detail__content">
                {chosen && (
                  <>
                    <strong className="surprise-detail__title">{chosen.title}</strong>
                    {renderAdminControls(chosen)}
                  </>
                )}
                {chosenSeries && (
                  <>
                    <strong className="surprise-detail__title">{chosenSeries.series.title}</strong>
                    {chosenSeries.episode ? (
                      <p className="muted">
                        Capítulo: S{chosenSeries.episode.seasonNumber}E{chosenSeries.episode.episodeNumber}
                        {chosenSeries.episode.name ? ` • ${chosenSeries.episode.name}` : ''}
                      </p>
                    ) : (
                      <p className="muted">Sin capítulos cargados.</p>
                    )}
                  </>
                )}
                {doubleFeature && (
                  <div className={`surprise-detail__double surprise-detail__double--${doubleFeature.position}`}>
                    <div className="surprise-detail__primary">
                      {renderPoster(doubleFeature.active, 'surprise-detail__poster surprise-detail__poster--primary')}
                      <strong className="surprise-detail__title">{doubleFeature.active.title}</strong>
                      {renderAdminControls(doubleFeature.active)}
                    </div>
                    <button
                      className="surprise-detail__secondary"
                      type="button"
                      onClick={swapDoubleFeature}
                    >
                      <span className="surprise-detail__secondary-label">
                        {doubleFeature.position === 'right' ? 'A continuación' : 'Anteriormente'}
                      </span>
                      {renderPoster(doubleFeature.secondary, 'surprise-detail__poster surprise-detail__poster--secondary')}
                      <strong>{doubleFeature.secondary.title}</strong>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
