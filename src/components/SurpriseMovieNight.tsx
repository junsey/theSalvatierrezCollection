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
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [excludeSeen, setExcludeSeen] = useState(excludeSeenDefault);
  const [chosen, setChosen] = useState<MovieRecord | null>(null);
  const [doubleFeature, setDoubleFeature] = useState<{ first: MovieRecord; second: MovieRecord; link: string } | null>(null);
  const [showAllSections, setShowAllSections] = useState(false);
  const [isSummoning, setIsSummoning] = useState(false);
  const [statusInputs, setStatusInputs] = useState<
    Record<string, { seen: boolean; ratingGloria: string; ratingRodrigo: string; busy?: boolean; error?: string }>
  >({});

  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);
  const initialSections = useMemo(() => sections.slice(0, 5), [sections]);
  const visibleSections = showAllSections ? sections : initialSections;

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const sectionMatch = selectedSections.length === 0 || selectedSections.includes(m.seccion);
      const seenMatch = excludeSeen ? !m.seen : true;
      const seriesMatch = !m.series;
      return sectionMatch && seenMatch && seriesMatch;
    });
  }, [movies, selectedSections, excludeSeen]);

  const toggleSection = (section: string) => {
    setDoubleFeature(null);
    setChosen(null);
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const toggleAllSections = () => {
    setDoubleFeature(null);
    setChosen(null);
    setSelectedSections((prev) => (prev.length === sections.length ? [] : sections));
  };

  const summon = () => {
    if (filtered.length === 0) {
      setChosen(null);
      setDoubleFeature(null);
      return;
    }
    setIsSummoning(true);
    setTimeout(() => {
      const random = filtered[Math.floor(Math.random() * filtered.length)];
      setChosen(random);
      setDoubleFeature(null);
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

  const summonDoubleFeature = () => {
    if (filtered.length === 0) {
      setChosen(null);
      setDoubleFeature(null);
      return;
    }

    setIsSummoning(true);
    setTimeout(() => {
      const primary = filtered[Math.floor(Math.random() * filtered.length)];
      const secondaryResult = pickRelated(primary);

      if (!secondaryResult) {
        setChosen(primary);
        setDoubleFeature(null);
        setIsSummoning(false);
        return;
      }

      setChosen(null);
      setDoubleFeature({ first: primary, second: secondaryResult.movie, link: secondaryResult.link });
      setIsSummoning(false);
    }, 1200);
  };

  useEffect(() => {
    const hasResult = Boolean(chosen || doubleFeature);
    const shouldLock = isSummoning || hasResult;
    if (!shouldLock) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [chosen, doubleFeature, isSummoning]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (chosen || doubleFeature) {
        setChosen(null);
        setDoubleFeature(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chosen, doubleFeature]);

  useEffect(() => {
    const targets = [chosen, doubleFeature?.first, doubleFeature?.second].filter(Boolean) as MovieRecord[];
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

  const renderPoster = (movie: MovieRecord) => (
    <div className="feature-poster-frame" aria-hidden={!movie.posterUrl}>
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

  return (
    <div className="ritual-panel">
      <header className="ritual-panel__header">
        <p className="ritual-panel__eyebrow">Surprise Movie Night</p>
        <h2>El ritual de la colección</h2>
        <p className="text-muted">Prepara los filtros, invoca el azar y descubre la próxima película.</p>
      </header>

      <section className="ritual-stage">
        <div className="ritual-stage__label">I · Preparación</div>
        <div className="ritual-filters">
          <div className="ritual-sections">
            <span className="ritual-section__label">Secciones</span>
            <div className="section-pills">
              <button
                className={`pill ${selectedSections.length === sections.length && sections.length > 0 ? 'active' : ''}`}
                onClick={toggleAllSections}
                type="button"
              >
                Todas
              </button>
              {visibleSections.map((section) => (
                <button
                  key={section}
                  className={`pill ${selectedSections.includes(section) ? 'active' : ''}`}
                  onClick={() => toggleSection(section)}
                  type="button"
                >
                  {section}
                </button>
              ))}
              {sections.length > initialSections.length && (
                <button
                  className="pill ghost"
                  type="button"
                  onClick={() => setShowAllSections((prev) => !prev)}
                >
                  {showAllSections ? 'Ver menos' : 'Ver más secciones'}
                </button>
              )}
            </div>
          </div>
          <button
            className={`toggle-control ${excludeSeen ? 'on' : ''}`}
            onClick={() => setExcludeSeen((prev) => !prev)}
            type="button"
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">{excludeSeen ? 'Excluir vistas' : 'Incluir vistas'}</span>
          </button>
        </div>
        <div className="random-actions ritual-actions">
          <button onClick={summon} className="action-large">
            Summon a Movie
          </button>
          <button onClick={summonDoubleFeature} className="action-large secondary">
            Summon a Double Feature
          </button>
        </div>
        {filtered.length === 0 && <p className="muted">No hay películas para invocar con estos filtros.</p>}
      </section>

      {isSummoning && (
        <div className="ritual-invocation">
          <div className="ritual-invocation__glow" aria-hidden />
          <p>Barajando la colección…</p>
        </div>
      )}

      {(chosen || doubleFeature) && (
        <div className="surprise-modal" role="dialog" aria-label="Resultados de Surprise Night">
          <div className="surprise-card">
            <div className="surprise-card__header">
              <h3>{doubleFeature ? 'Revelación doble' : 'Revelación'}</h3>
              <button className="ghost" onClick={() => { setChosen(null); setDoubleFeature(null); }}>
                Cerrar
              </button>
            </div>

            {chosen && (
              <div className="summon-result minimal">
                <div className="feature-simple">
                  {renderPoster(chosen)}
                  <strong>{chosen.title}</strong>
                </div>
                <div className="result-actions tight">
                  <button onClick={() => onSelect(chosen)}>Abrir detalles</button>
                  <button onClick={summon}>Volver a invocar</button>
                </div>
                {renderAdminControls(chosen)}
              </div>
            )}

            {doubleFeature && (
              <div className="double-feature minimal">
                <div className="double-heading">
                  <p className="link-reason">Enlace: {doubleFeature.link}</p>
                </div>
                <div className="feature-duo">
                  {[doubleFeature.first, doubleFeature.second].map((item, idx) => (
                    <div key={item.id} className="feature-card simple">
                      <div className="feature-meta">
                        <span className="feature-pill">{idx === 0 ? 'Primero…' : 'Luego…'}</span>
                        {renderPoster(item)}
                        <strong>{item.title}</strong>
                      </div>
                      <div className="result-actions tight">
                        <button onClick={() => onSelect(item)}>Abrir detalles</button>
                      </div>
                      {renderAdminControls(item)}
                    </div>
                  ))}
                </div>
                <div className="result-actions tight">
                  <button onClick={summonDoubleFeature}>Volver a invocar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
