import React, { useMemo, useState } from 'react';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
  excludeSeenDefault?: boolean;
}

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

export const SurpriseMovieNight: React.FC<Props> = ({ movies, onSelect, excludeSeenDefault = true }) => {
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [excludeSeen, setExcludeSeen] = useState(excludeSeenDefault);
  const [chosen, setChosen] = useState<MovieRecord | null>(null);
  const [doubleFeature, setDoubleFeature] = useState<{ first: MovieRecord; second: MovieRecord; link: string } | null>(null);

  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);

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
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    setChosen(random);
    setDoubleFeature(null);
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

    const primary = filtered[Math.floor(Math.random() * filtered.length)];
    const secondaryResult = pickRelated(primary);

    if (!secondaryResult) {
      setChosen(primary);
      setDoubleFeature(null);
      return;
    }

    setChosen(null);
    setDoubleFeature({ first: primary, second: secondaryResult.movie, link: secondaryResult.link });
  };

  return (
    <div className="panel">
      <h2>Ritual of Random Cinema</h2>
      <div className="filters">
        <div className="section-filter">
          <small>Secciones</small>
          <div className="section-pills">
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
          <p className="pill-hint">Selecciona una o varias secciones o invoca todas.</p>
        </div>
        <button className={`toggle-control ${excludeSeen ? 'on' : ''}`} onClick={() => setExcludeSeen((prev) => !prev)} type="button">
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">{excludeSeen ? 'Excluir vistas' : 'Incluir vistas'}</span>
        </button>
      </div>
      <div className="random-area">
        <div className="random-actions">
          <button onClick={summon} style={{ fontSize: 18, padding: '12px 18px' }}>
            Summon a Movie
          </button>
          <button onClick={summonDoubleFeature} className="secondary" style={{ fontSize: 18, padding: '12px 18px' }}>
            Summon a Double Feature
          </button>
        </div>
        {filtered.length === 0 && <p>No movies match the ritual filters.</p>}
      </div>
      {(chosen || doubleFeature) && (
        <div className="surprise-modal" role="dialog" aria-label="Resultados de Surprise Night">
          <div className="surprise-card">
            <div className="surprise-card__header">
              <h3>{doubleFeature ? 'Double Feature' : 'Selección'}</h3>
              <button className="ghost" onClick={() => { setChosen(null); setDoubleFeature(null); }}>
                Cerrar
              </button>
            </div>

            {chosen && (
              <div className="summon-result minimal">
                <div className="feature-simple">
                  <strong>{chosen.title}</strong>
                  <p className="plot-snippet">{chosen.plot ?? 'Sin descripción disponible.'}</p>
                </div>
                <div className="result-actions">
                  <button onClick={() => onSelect(chosen)}>Abrir detalles</button>
                  <button onClick={summon}>Volver a invocar</button>
                </div>
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
                        <span className="feature-pill">{idx === 0 ? 'Acto I' : 'Acto II'}</span>
                        <strong>{item.title}</strong>
                        <p className="plot-snippet">{item.plot ?? 'Sin descripción disponible.'}</p>
                      </div>
                      <div className="result-actions">
                        <button className="ghost" onClick={() => onSelect(item)}>
                          Abrir detalles
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="result-actions">
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
