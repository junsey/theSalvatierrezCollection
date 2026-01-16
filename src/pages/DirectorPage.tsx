import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { DirectedMovie, fetchDirectorFromTMDb } from '../services/tmdbPeopleService';
import { refreshDirectorTmdb } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';
import { buildDirectorOverrideMap, normalizeDirectorName, splitDirectors } from '../services/directors';
import { buildDirectorProfileUrl, fetchDirectorByName, fetchDirectorFilmographyByPersonId } from '../services/supabaseDirectors';
import { clearDirectorCache } from '../lib/directorCache';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

const normalizeTitle = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const buildDirectorCollections = (directorName: string, collection: MovieRecord[]) => {
  const normalizedDirector = normalizeDirectorName(directorName);
  const ownedIds = new Set<number>();
  const ownedTitles = new Set<string>();
  const hiddenOwnedIds = new Set<number>();
  const hiddenOwnedTitles = new Set<string>();

  collection.forEach((movie) => {
    const matchesDirector = splitDirectors(movie.director)
      .map(normalizeDirectorName)
      .includes(normalizedDirector);

    if (!matchesDirector) return;

    const isHidden = movie.seccion.trim().toLowerCase() === 'z-inexistente';

    if (Number.isFinite(movie.tmdbId) && movie.tmdbId != null) {
      ownedIds.add(movie.tmdbId);
      if (isHidden) {
        hiddenOwnedIds.add(movie.tmdbId);
      }
    }

    const normalizedTitle = normalizeTitle(movie.title);
    ownedTitles.add(normalizedTitle);
    if (isHidden) {
      hiddenOwnedTitles.add(normalizedTitle);
    }
    if (movie.tmdbTitle) {
      const normalizedTmdbTitle = normalizeTitle(movie.tmdbTitle);
      ownedTitles.add(normalizedTmdbTitle);
      if (isHidden) {
        hiddenOwnedTitles.add(normalizedTmdbTitle);
      }
    }
    if (movie.originalTitle) {
      const normalizedOriginal = normalizeTitle(movie.originalTitle);
      ownedTitles.add(normalizedOriginal);
      if (isHidden) {
        hiddenOwnedTitles.add(normalizedOriginal);
      }
    }
    if (movie.tmdbOriginalTitle) {
      const normalizedTmdbOriginal = normalizeTitle(movie.tmdbOriginalTitle);
      ownedTitles.add(normalizedTmdbOriginal);
      if (isHidden) {
        hiddenOwnedTitles.add(normalizedTmdbOriginal);
      }
    }
  });

  return { ownedIds, ownedTitles, hiddenOwnedIds, hiddenOwnedTitles };
};

export const DirectorPage: React.FC = () => {
  const { name } = useParams();
  const directorName = decodeURIComponent(name ?? '').trim();
  const { movies, tmdbEnrichmentEnabled, adminSession } = useMovies();
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
  const [tmdbPersonId, setTmdbPersonId] = useState<number | null>(null);
  const [adminTmdbId, setAdminTmdbId] = useState('');
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [bioOpen, setBioOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadDirector() {
      setLoading(true);
      setError(null);
      setBiography(null);
      setProfileUrl(undefined);
      setKnownFor([]);
      setRefreshMessage(null);

      if (!directorName) {
        setError('No se especificó director.');
        setLoading(false);
        return;
      }

      try {
        const overrideTmdbId = directorOverrides.get(normalizeDirectorName(directorName));
        const supabaseDirector = await fetchDirectorByName(directorName);
        const supabaseTmdbId = supabaseDirector?.tmdb_person_id ?? overrideTmdbId ?? null;
        const supabaseProfile = await buildDirectorProfileUrl(supabaseDirector?.profile_path ?? null);
        const supabaseFilmography = supabaseTmdbId
          ? await fetchDirectorFilmographyByPersonId(supabaseTmdbId)
          : [];

        if (!active) return;

        if (supabaseDirector?.name) {
          setPersonName(supabaseDirector.name);
        }
        setTmdbPersonId(supabaseTmdbId);
        setAdminTmdbId(supabaseTmdbId ? String(supabaseTmdbId) : '');
        if (supabaseProfile) {
          setProfileUrl(supabaseProfile);
        }
        if (supabaseFilmography.length > 0) {
          setKnownFor(supabaseFilmography);
        }

        const shouldFetchTmdb = true;
        if (!shouldFetchTmdb) {
          setLoading(false);
          return;
        }

        const result = await fetchDirectorFromTMDb({ name: directorName, tmdbId: supabaseTmdbId ?? overrideTmdbId });
        if (!active) return;

        if (!result) {
          setError('No se encontrA3 al director en TMDb.');
          setLoading(false);
          return;
        }

        setPersonName(result.person?.name ?? result.resolvedName ?? directorName);
        setBiography(result.person?.biography ?? null);
        setProfileUrl((supabaseProfile ?? result.person?.profileUrl) ?? undefined);
        setAdminTmdbId(result.tmdbId ? String(result.tmdbId) : '');
        if (!supabaseFilmography.length) {
          setKnownFor(result.credits);
        }
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
  }, [directorName, directorOverrides, tmdbEnrichmentEnabled]);

  const handleRefreshDirector = async () => {
    if (!adminSession) return;
    const parsedId = adminTmdbId.trim() ? Number(adminTmdbId.trim()) : null;
    if (adminTmdbId.trim() && !Number.isFinite(parsedId)) {
      setRefreshMessage('El TMDb ID debe ser numérico.');
      return;
    }
    setRefreshBusy(true);
    setRefreshMessage(null);
    try {
      const response = await refreshDirectorTmdb({ name: directorName, tmdbId: parsedId ?? tmdbPersonId ?? null });
      if (response?.name) {
        setPersonName(response.name);
      }
      if (response?.profilePath) {
        const url = await buildDirectorProfileUrl(response.profilePath);
        setProfileUrl(url);
      }
      setBiography(response?.biography ?? null);
      if (response?.tmdbId) {
        const filmography = await fetchDirectorFilmographyByPersonId(response.tmdbId);
        setKnownFor(filmography);
        setTmdbPersonId(response.tmdbId);
        setAdminTmdbId(String(response.tmdbId));
      }
      clearDirectorCache();
      setRefreshMessage('TMDb actualizado para este director.');
    } catch (err) {
      console.error('No se pudo actualizar el director', err);
      setRefreshMessage('No se pudo actualizar TMDb.');
    } finally {
      setRefreshBusy(false);
    }
  };

  const { directedMovies, createdSeries, ownedCount, totalCount } = useMemo(() => {
    const directorJobs = new Set(['director', 'series director', 'director de la serie']);
    const creatorJobs = new Set(['creator', 'series creator']);

    const movieSeen = new Set<number>();
    const seriesSeen = new Set<number>();

    const isOwned = (title: string, id: number) =>
      directorCollection.ownedIds.has(id) || directorCollection.ownedTitles.has(normalizeTitle(title));
    const isHiddenOwned = (title: string, id: number) =>
      directorCollection.hiddenOwnedIds.has(id) ||
      directorCollection.hiddenOwnedTitles.has(normalizeTitle(title));

    const getYearValue = (item: DirectedMovie) => {
      if (item.year) return item.year;
      const date = item.mediaType === 'tv' ? item.firstAirDate : item.releaseDate;
      if (!date) return null;
      const parsed = Number.parseInt(date.slice(0, 4), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const sortByDate = (a: DirectedMovie, b: DirectedMovie) => {
      const yearA = getYearValue(a);
      const yearB = getYearValue(b);

      if (yearA != null && yearB != null && yearA !== yearB) return yearA - yearB;
      if (yearA == null && yearB != null) return 1;
      if (yearA != null && yearB == null) return -1;
      return (a.title || '').localeCompare(b.title || '');
    };

    const directed = knownFor
      .filter((credit) => credit.mediaType === 'movie' && directorJobs.has((credit.job ?? '').toLowerCase()))
      .filter((credit) => {
        if (movieSeen.has(credit.id)) return false;
        movieSeen.add(credit.id);
        return true;
      })
      .map((credit) => ({
        ...credit,
        owned: isOwned(credit.title, credit.id),
        hiddenOwned: isHiddenOwned(credit.title, credit.id)
      }))
      .sort(sortByDate);

    const created = knownFor
      .filter((credit) => credit.mediaType === 'tv' && creatorJobs.has((credit.job ?? '').toLowerCase()))
      .filter((credit) => {
        if (seriesSeen.has(credit.id)) return false;
        seriesSeen.add(credit.id);
        return true;
      })
      .map((credit) => ({
        ...credit,
        owned: isOwned(credit.title, credit.id),
        hiddenOwned: isHiddenOwned(credit.title, credit.id)
      }))
      .sort(sortByDate);

    const ownedCount = directed.filter((item) => item.owned).length + created.filter((item) => item.owned).length;
    const totalCount = directed.length + created.length;
    return {
      directedMovies: directed,
      createdSeries: created,
      ownedCount,
      totalCount
    };
  }, [directorCollection.ownedIds, directorCollection.ownedTitles, knownFor]);

  const bioSummary = useMemo(() => {
    if (!biography) return null;
    const trimmed = biography.trim();
    if (trimmed.length <= 300) return trimmed;
    return `${trimmed.slice(0, 300).trim()}…`;
  }, [biography]);

  useEffect(() => {
    if (!bioOpen) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [bioOpen]);

  const renderSection = (title: string, items: (DirectedMovie & { owned?: boolean })[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="filmography-block">
          <h2>{title}</h2>
          <p className="muted">{emptyMessage}</p>
        </div>
      );
    }

    type DisplayItem = (DirectedMovie & { owned?: boolean; hiddenOwned?: boolean }) | { id: string; placeholder: true };
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
            const hiddenOwned = owned && 'hiddenOwned' in item && Boolean(item.hiddenOwned);
            const mediaLabel = item.mediaType === 'tv' ? 'Serie' : 'Película';
            return (
              <div
                key={item.id}
                className={`known-for-card ${owned ? 'owned' : 'missing'}`}
                aria-label={owned ? 'En la colección' : 'Fuera de la colección'}
              >
                {hiddenOwned && <span className="known-for-card__badge">No Editado</span>}
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
                  </div>
                  <div className="known-for-card__meta-row known-for-card__meta-row--footer">
                    {item.year && <small>{item.year}</small>}
                    <span className="media-tag" aria-label={title}>
                      {mediaLabel}
                    </span>
                  </div>
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
            <div className="collection-badge director-collection" aria-label={`En colección: ${ownedCount} de ${totalCount || '—'}`}>
              <span className="collection-badge__label">Estado de colección</span>
              <div className="collection-badge__stats">
                <span className="collection-badge__value">{ownedCount}</span>
                <span className="collection-badge__divider">/</span>
                <span className="collection-badge__total">{totalCount || '—'}</span>
              </div>
            </div>
          </div>
          {loading && <p className="text-muted">Recopilando biografía...</p>}
          {!loading && bioSummary && (
            <div className="director-bio">
              <p className="text-muted director-legend__bio">{bioSummary}</p>
              {biography && biography.length > 300 && (
                <button className="ghost director-bio__button" type="button" onClick={() => setBioOpen(true)}>
                  Ver bio completa
                </button>
              )}
            </div>
          )}
          {!loading && !biography && <p className="text-muted director-legend__bio">Biografía no disponible.</p>}
          {adminSession && (
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>TMDb ID</span>
                <input
                  type="number"
                  value={adminTmdbId}
                  onChange={(event) => setAdminTmdbId(event.target.value)}
                  style={{ width: 120 }}
                />
              </label>
              <button className="btn" onClick={handleRefreshDirector} disabled={refreshBusy}>
                {refreshBusy ? 'Actualizando...' : 'Actualizar TMDb'}
              </button>
              {refreshMessage && <span className="text-muted">{refreshMessage}</span>}
            </div>
          )}
        </div>
      </div>

      {error && <p className="muted">{error}</p>}

      {!error && (
        <>
          {loading ? (
            <div className="filmography-block">
              <h2>Filmografía</h2>
              <div className="known-for-grid">
                {Array.from({ length: 8 }, (_, idx) => (
                  <div key={`filmography-skeleton-${idx}`} className="known-for-card known-for-card--skeleton" aria-hidden>
                    <div className="known-for-card__poster skeleton" />
                    <div className="known-for-card__meta">
                      <div className="known-for-card__meta-row">
                        <span className="skeleton skeleton-text" />
                      </div>
                      <div className="known-for-card__meta-row known-for-card__meta-row--footer">
                        <span className="skeleton skeleton-text skeleton-text--short" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="director-filmography__summary">
                Filmografía ({totalCount || '—'} películas · {ownedCount} en tu colección)
              </p>
              {adminSession && knownFor.length === 0 && (
                <p className="muted">No hay filmografía en Supabase. Usa "Actualizar TMDb" para generarla.</p>
              )}
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
      {bioOpen && biography && (
        <div className="director-bio-modal__overlay" onClick={() => setBioOpen(false)}>
          <div
            className="director-bio-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Biografía de ${personName || directorName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="director-bio-modal__header">
              <h2>Biografía completa</h2>
              <button className="ghost" type="button" onClick={() => setBioOpen(false)} aria-label="Cerrar biografía">
                ✕
              </button>
            </div>
            <div className="director-bio-modal__body">
              <p>{biography}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
