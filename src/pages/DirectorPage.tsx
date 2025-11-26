import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { DirectedMovie, fetchDirectorFromTMDb } from '../services/tmdbPeopleService';
import { MovieRecord } from '../types/MovieRecord';
import { buildDirectorOverrideMap, normalizeDirectorName, splitDirectors } from '../services/directors';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

const normalizeTitle = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const buildDirectorCollections = (directorName: string, collection: MovieRecord[]) => {
  const normalizedDirector = normalizeDirectorName(directorName);
  const ownedIds = new Set<number>();
  const ownedTitles = new Set<string>();

  collection.forEach((movie) => {
    const matchesDirector = splitDirectors(movie.director)
      .map(normalizeDirectorName)
      .includes(normalizedDirector);

    if (!matchesDirector) return;

    if (Number.isFinite(movie.tmdbId) && movie.tmdbId != null) {
      ownedIds.add(movie.tmdbId);
    }

    ownedTitles.add(normalizeTitle(movie.title));
    if (movie.tmdbTitle) {
      ownedTitles.add(normalizeTitle(movie.tmdbTitle));
    }
    if (movie.originalTitle) {
      ownedTitles.add(normalizeTitle(movie.originalTitle));
    }
    if (movie.tmdbOriginalTitle) {
      ownedTitles.add(normalizeTitle(movie.tmdbOriginalTitle));
    }
  });

  return { ownedIds, ownedTitles };
};

export const DirectorPage: React.FC = () => {
  const { name } = useParams();
  const directorName = decodeURIComponent(name ?? '').trim();
  const { movies } = useMovies();
  const directorOverrides = useMemo(() => buildDirectorOverrideMap(movies), [movies]);
  const directorCollection = useMemo(
    () => buildDirectorCollections(directorName, movies),
    [directorName, movies]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string>(directorName);
  const [biography, setBiography] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | undefined>();
  const [knownFor, setKnownFor] = useState<DirectedMovie[]>([]);

  useEffect(() => {
    let active = true;
    async function loadDirector() {
      setLoading(true);
      setError(null);
      setBiography(null);
      setProfileUrl(undefined);
      setKnownFor([]);

      if (!directorName) {
        setError('No se especificó director.');
        setLoading(false);
        return;
      }

      try {
        const overrideTmdbId = directorOverrides.get(normalizeDirectorName(directorName));
        const result = await fetchDirectorFromTMDb({ name: directorName, tmdbId: overrideTmdbId });
        if (!active) return;

        if (!result) {
          setError('No se encontró al director en TMDb.');
          setLoading(false);
          return;
        }

        setPersonName(result.person?.name ?? result.resolvedName ?? directorName);
        setBiography(result.person?.biography ?? null);
        setProfileUrl(result.person?.profileUrl ?? undefined);
        setKnownFor(result.credits);
      } catch (err) {
        console.warn('Error al cargar el director', err);
        if (active) setError('No se pudieron obtener los datos del director.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDirector();
    return () => {
      active = false;
    };
  }, [directorName, directorOverrides]);

  const { directedMovies, createdSeries, ownedCount, totalCount, medalUnlocks } = useMemo(() => {
    const directorJobs = new Set(['director', 'series director', 'director de la serie']);
    const creatorJobs = new Set(['creator', 'series creator']);

    const movieSeen = new Set<number>();
    const seriesSeen = new Set<number>();

    const isOwned = (title: string, id: number) =>
      directorCollection.ownedIds.has(id) || directorCollection.ownedTitles.has(normalizeTitle(title));

    const sortByDate = (a: DirectedMovie, b: DirectedMovie) => {
      const dateA = a.mediaType === 'tv' ? a.firstAirDate : a.releaseDate;
      const dateB = b.mediaType === 'tv' ? b.firstAirDate : b.releaseDate;

      const tsA = dateA ? Date.parse(dateA) : Number.POSITIVE_INFINITY;
      const tsB = dateB ? Date.parse(dateB) : Number.POSITIVE_INFINITY;

      if (tsA !== tsB) return tsA - tsB;
      return (a.title || '').localeCompare(b.title || '');
    };

    const directed = knownFor
      .filter((credit) => credit.mediaType === 'movie' && directorJobs.has((credit.job ?? '').toLowerCase()))
      .filter((credit) => {
        if (movieSeen.has(credit.id)) return false;
        movieSeen.add(credit.id);
        return true;
      })
      .map((credit) => ({ ...credit, owned: isOwned(credit.title, credit.id) }))
      .sort(sortByDate);

    const created = knownFor
      .filter((credit) => credit.mediaType === 'tv' && creatorJobs.has((credit.job ?? '').toLowerCase()))
      .filter((credit) => {
        if (seriesSeen.has(credit.id)) return false;
        seriesSeen.add(credit.id);
        return true;
      })
      .map((credit) => ({ ...credit, owned: isOwned(credit.title, credit.id) }))
      .sort(sortByDate);

    const ownedCount = directed.filter((item) => item.owned).length + created.filter((item) => item.owned).length;
    const totalCount = directed.length + created.length;
    const ratio = totalCount > 0 ? ownedCount / totalCount : 0;

    return {
      directedMovies: directed,
      createdSeries: created,
      ownedCount,
      totalCount,
      medalUnlocks: {
        bronze: ratio > 0.5,
        silver: ratio > 0.75,
        gold: ratio >= 1
      }
    };
  }, [directorCollection.ownedIds, directorCollection.ownedTitles, knownFor]);

  const detailMedal = useMemo(() => {
    if (!totalCount || totalCount <= 0) return null;
    if (medalUnlocks.gold) return 'gold';
    if (medalUnlocks.silver) return 'silver';
    if (medalUnlocks.bronze) return 'bronze';
    return null;
  }, [medalUnlocks, totalCount]);

  const renderSection = (title: string, items: (DirectedMovie & { owned?: boolean })[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="filmography-block">
          <h2>{title}</h2>
          <p className="muted">{emptyMessage}</p>
        </div>
      );
    }

    type DisplayItem = (DirectedMovie & { owned?: boolean }) | { id: string; placeholder: true };
    const placeholders = Array.from({ length: Math.max(0, 7 - items.length) }, (_, idx) => ({
      id: `${title}-placeholder-${idx}`,
      placeholder: true as const
    }));
    const displayItems: DisplayItem[] = [...items, ...placeholders];

    return (
      <div className="filmography-block">
        <h2>{title}</h2>
        <div className="known-for-grid">
          {displayItems.map((item) => {
            if ('placeholder' in item) {
              return (
                <div key={item.id} className="known-for-card known-for-card--placeholder" aria-hidden>
                  <div className="known-for-card__poster" />
                  <div className="known-for-card__meta" />
                </div>
              );
            }

            const owned = item.owned;
            return (
              <div
                key={item.id}
                className={`known-for-card ${owned ? 'owned' : 'missing'}`}
                aria-label={owned ? 'En la colección' : 'Fuera de la colección'}
              >
                <div className="known-for-card__poster">
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.title} className={!owned ? 'is-muted' : undefined} />
                  ) : (
                    <div className={`poster-fallback ${!owned ? 'is-muted' : ''}`} aria-hidden />
                  )}
                </div>
                <div className="known-for-card__meta">
                  <div className="known-for-card__meta-row">
                    <p className={!owned ? 'muted' : undefined}>{item.title}</p>
                    <span className="media-tag" aria-label={title}>
                      {item.mediaType === 'tv' ? 'Serie' : 'Película'}
                    </span>
                  </div>
                  {item.year && <small>{item.year}</small>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <Link to="/directors" className="btn" style={{ padding: '6px 12px' }}>
          ← Volver a directores
        </Link>
      </div>
      <div className="director-hero">
        <div
          className="director-portrait"
          style={{ backgroundImage: `url(${profileUrl ?? FALLBACK_PORTRAIT})` }}
          aria-hidden="true"
        />
        <div className="director-legend">
          <div className="director-legend__top">
            <div className="director-legend__titles">
              <p className="eyebrow">Directores</p>
              <h1>{personName || directorName}</h1>
            </div>
            <div
              className={['collection-badge', detailMedal ? `collection-badge--${detailMedal}` : '']
                .filter(Boolean)
                .join(' ')}
              aria-label={`En colección: ${ownedCount} de ${totalCount || '—'}`}
            >
              <span className="collection-badge__label">En colección</span>
              <div className="collection-badge__stats">
                <span className="collection-badge__value">{ownedCount}</span>
                <span className="collection-badge__divider">/</span>
                <span className="collection-badge__total">{totalCount || '—'}</span>
                {detailMedal && (
                  <span
                    className={`collection-badge__medal director-coverage__medal director-coverage__medal--${detailMedal}`}
                    aria-hidden
                  >
                    ★
                  </span>
                )}
              </div>
            </div>
          </div>
          {loading && <p className="text-muted">Recopilando biografía...</p>}
          {!loading && biography && <p className="text-muted director-legend__bio">{biography}</p>}
          {!loading && !biography && <p className="text-muted director-legend__bio">Biografía no disponible.</p>}
        </div>
      </div>

      {error && <p className="muted">{error}</p>}

      {!error && (
        <>
          {loading ? (
            <div className="filmography-block">
              <h2>Filmografía</h2>
              <p className="muted">Cargando filmografía...</p>
            </div>
          ) : (
            <>
              {directedMovies.length > 0
                ? renderSection('Obras dirigidas (cine)', directedMovies, 'No hay películas dirigidas registradas.')
                : renderSection('Obras dirigidas (cine)', directedMovies, 'No se encontraron películas dirigidas para esta persona.')}

              {createdSeries.length > 0
                ? renderSection(
                    'Series creadas (TV)',
                    createdSeries,
                    'No hay series creadas registradas para esta persona.'
                  )
                : renderSection(
                    'Series creadas (TV)',
                    createdSeries,
                    'No hay series en las que conste como creador/a.'
                  )}

              {directedMovies.length === 0 && createdSeries.length === 0 && (
                <p className="muted">No se encontraron obras con los criterios actuales.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};
