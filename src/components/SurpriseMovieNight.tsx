import React, { useMemo, useState } from 'react';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
  excludeSeenDefault?: boolean;
}

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

export const SurpriseMovieNight: React.FC<Props> = ({ movies, onSelect, excludeSeenDefault = true }) => {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [excludeSeen, setExcludeSeen] = useState(excludeSeenDefault);
  const [chosen, setChosen] = useState<MovieRecord | null>(null);

  const genres = useMemo(
    () => unique(movies.flatMap((m) => m.genreRaw.split(/[,;\-/]/g).map((g) => g.trim()))),
    [movies]
  );
  const sections = useMemo(() => unique(movies.map((m) => m.seccion)), [movies]);

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const genreMatch = selectedGenres.length === 0 || selectedGenres.some((g) => m.genreRaw.includes(g));
      const sectionMatch = selectedSections.length === 0 || selectedSections.includes(m.seccion);
      const seenMatch = excludeSeen ? !m.seen : true;
      return genreMatch && sectionMatch && seenMatch;
    });
  }, [movies, selectedGenres, selectedSections, excludeSeen]);

  const summon = () => {
    if (filtered.length === 0) {
      setChosen(null);
      return;
    }
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    setChosen(random);
    onSelect(random);
  };

  const toggleValue = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  return (
    <div className="panel">
      <h2>Ritual of Random Cinema</h2>
      <div className="filters">
        <div>
          <small>Genre</small>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 500 }}>
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleValue(selectedGenres, genre, setSelectedGenres)}
                style={{
                  background: selectedGenres.includes(genre) ? 'rgba(255,54,93,0.3)' : undefined,
                  borderColor: selectedGenres.includes(genre) ? 'rgba(255,54,93,0.6)' : undefined
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
        <div>
          <small>Sections</small>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 500 }}>
            {sections.map((section) => (
              <button
                key={section}
                onClick={() => toggleValue(selectedSections, section, setSelectedSections)}
                style={{
                  background: selectedSections.includes(section) ? 'rgba(126,166,217,0.25)' : undefined,
                  borderColor: selectedSections.includes(section) ? 'rgba(126,166,217,0.5)' : undefined
                }}
              >
                {section}
              </button>
            ))}
          </div>
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
              {chosen.year ?? 'Year ?'} • {chosen.seccion}
              <br /> IMDb: {chosen.imdbRating ?? 'N/A'}
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
