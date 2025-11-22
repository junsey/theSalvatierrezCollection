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

  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const sectionMatch = selectedSections.length === 0 || selectedSections.includes(m.seccion);
      const seenMatch = excludeSeen ? !m.seen : true;
      return sectionMatch && seenMatch;
    });
  }, [movies, selectedSections, excludeSeen]);

  const summon = () => {
    if (filtered.length === 0) {
      setChosen(null);
      return;
    }
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    setChosen(random);
    onSelect(random);
  };

  return (
    <div className="panel">
      <h2>Ritual of Random Cinema</h2>
      <div className="filters">
        <div>
          <small>Sections</small>
          <select
            multiple
            value={selectedSections}
            onChange={(e) =>
              setSelectedSections(Array.from(e.target.selectedOptions).map((opt) => opt.value))
            }
            style={{ minWidth: 240, minHeight: 120, background: 'var(--panel)', color: 'var(--text)' }}
          >
            {sections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 12, opacity: 0.8 }}>Selecciona una o varias secciones (Ctrl/Cmd + click).</p>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={excludeSeen} onChange={(e) => setExcludeSeen(e.target.checked)} /> Exclude seen
        </label>
      </div>
      <div className="random-area">
        <button onClick={summon} style={{ fontSize: 18, padding: '12px 18px' }}>
          Summon a Movie
        </button>
        {filtered.length === 0 && <p>No movies match the ritual filters.</p>}
        {chosen && (
          <div style={{ marginTop: 16, animation: 'fadeIn 0.3s ease' }}>
            <strong>{chosen.title}</strong>
            <p>
              {chosen.tmdbYear ?? chosen.year ?? 'Year ?'} • {chosen.seccion}
              <br /> TMDb: {chosen.tmdbRating?.toFixed(1) ?? 'N/A'}
            </p>
            <img
              src={chosen.posterUrl ?? 'https://via.placeholder.com/200x300/0b0f17/ffffff?text=No+Poster'}
              alt={chosen.title}
              style={{ maxWidth: 200, width: '100%', borderRadius: 12 }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => onSelect(chosen)}>Open details</button>
              <button onClick={summon}>Roll again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
