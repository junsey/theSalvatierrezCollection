import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { DirectedMovie, getPersonDirectedMovies, getPersonDetails } from '../services/tmdbPeopleService';
import { getWikipediaSummaryAndThumbnail, searchWikipediaArticle } from '../services/wikipediaService';
import { buildOriginalTitleMap, buildOwnedTmdbIdSet, isCreditOwned } from '../utils/titleMatching';

type DirectorCardProps = {
  directorId: number;
  name: string;
};

type DirectorProfileState = {
  biography: string | null;
  photoUrl?: string;
  placeOfBirth?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  alsoKnownAs?: string[];
  filmography: DirectedMovie[];
  loading: boolean;
};

const formatDate = (date?: string | null) => {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (error) {
    return date;
  }
};

export const DirectorCard: React.FC<DirectorCardProps> = ({ directorId, name }) => {
  const { movies } = useMovies();
  const [state, setState] = useState<DirectorProfileState>({ biography: null, filmography: [], loading: true });

  const titleLookup = useMemo(() => buildOriginalTitleMap(movies), [movies]);
  const ownedIds = useMemo(() => buildOwnedTmdbIdSet(movies), [movies]);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const [details, directed] = await Promise.all([
          getPersonDetails(directorId),
          getPersonDirectedMovies(directorId, { ownedIds })
        ]);

        const resolvedName = details?.name ?? name;
        const wikiTitle = resolvedName ? await searchWikipediaArticle(resolvedName) : null;
        const wiki = wikiTitle ? await getWikipediaSummaryAndThumbnail(wikiTitle) : { summary: null, thumbnailUrl: null };

        if (!active) return;
        setState({
          biography: wiki.summary || details?.biography || null,
          photoUrl: wiki.thumbnailUrl || details?.profileUrl,
          placeOfBirth: details?.placeOfBirth,
          birthday: details?.birthday,
          deathday: details?.deathday,
          alsoKnownAs: details?.alsoKnownAs,
          filmography: directed,
          loading: false
        });
      } catch (error) {
        console.warn('No se pudo cargar el perfil del director', error);
        if (!active) return;
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [directorId, name, ownedIds]);

  const portrait =
    state.photoUrl ||
    'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

  return (
    <div className="director-card panel">
      <div className="director-card__header">
        <div className="director-card__portrait">
          <img src={portrait} alt={name} />
          <span className="director-card__sigil" aria-hidden>
            ✦
          </span>
        </div>
        <div className="director-card__meta">
          <h3>{name}</h3>
          {state.loading && <p className="muted">Invocando biografía...</p>}
          {!state.loading && state.biography && <p className="muted">{state.biography}</p>}
          {!state.loading && !state.biography && <p className="muted">Biografía no disponible.</p>}
          <div className="director-card__facts">
            {state.placeOfBirth && (
              <span>
                Origen: <strong>{state.placeOfBirth}</strong>
              </span>
            )}
            {state.birthday && (
              <span>
                Nacimiento: <strong>{formatDate(state.birthday)}</strong>
              </span>
            )}
            {state.deathday && (
              <span>
                Fallecimiento: <strong>{formatDate(state.deathday)}</strong>
              </span>
            )}
          </div>
          {state.alsoKnownAs && state.alsoKnownAs.length > 0 && (
            <div className="director-card__aka">
              <small>También conocido como</small>
              <div className="tags">
                {state.alsoKnownAs.map((aka) => (
                  <span key={aka} className="pill">
                    {aka}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="director-card__films">
        <h4>Filmografía seleccionada</h4>
        {state.loading && <p className="muted">Consultando obeliscos de celuloide...</p>}
        {!state.loading && state.filmography.length === 0 && <p className="muted">Sin registros de dirección.</p>}
        <ul className="filmography-list">
          {(() => {
            const sorted = [...state.filmography].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
            const owned: DirectedMovie[] = [];
            const unowned: DirectedMovie[] = [];
            sorted.forEach((film) => {
              const isOwned = isCreditOwned(film, ownedIds, titleLookup);
              if (isOwned) {
                owned.push(film);
              } else {
                unowned.push(film);
              }
            });

            const MAX_ITEMS = 12;
            const entries =
              owned.length >= MAX_ITEMS
                ? owned.map((film) => ({ film, owned: true }))
                : [
                    ...owned.map((film) => ({ film, owned: true })),
                    ...unowned.slice(0, Math.max(MAX_ITEMS - owned.length, 0)).map((film) => ({ film, owned: false }))
                  ];

            return entries.map(({ film, owned }) => {
              const label = film.year ? `${film.title} (${film.year})` : film.title;
              const linkTarget = owned ? `/movies?tmdbId=${film.id}` : undefined;
              return (
                <li key={`${film.id}-${film.title}`} className={owned ? 'owned' : 'pending'}>
                  {linkTarget ? (
                    <Link to={linkTarget} className="film-link">
                      {label}
                    </Link>
                  ) : (
                    <span className="film-link muted">{label}</span>
                  )}
                  <span className="pill">{owned ? 'En colección' : 'Pendiente'}</span>
                </li>
              );
            });
          })()}
        </ul>
      </div>
    </div>
  );
};
