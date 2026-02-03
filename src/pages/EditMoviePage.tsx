import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { updateMovie } from '../services/adminApi';

type FormState = {
  seccion: string;
  title: string;
  year: string;
  saga: string;
  originalTitle: string;
  genreRaw: string;
  director: string;
  group: string;
  seen: boolean;
  series: boolean;
  season: string;
  ratingGloria: string;
  ratingRodrigo: string;
  dubbing: '' | 'true' | 'false';
  format: string;
  region: string;
  enDeposito: boolean;
  funcionaStatus: 'working' | 'damaged' | 'untested';
};

const parseNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

export const EditMoviePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { movies, adminSession, refreshSupabase } = useMovies();
  const movie = useMemo(() => movies.find((item) => item.id === id), [movies, id]);
  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const redirectRef = useRef<number | null>(null);

  const sectionOptions = useMemo(
    () => Array.from(new Set(movies.map((item) => item.seccion).filter(Boolean))).sort(),
    [movies]
  );

  useEffect(() => {
    if (!movie) return;
    setForm({
      seccion: movie.seccion ?? '',
      title: movie.title ?? '',
      year: movie.year != null ? String(movie.year) : '',
      saga: movie.saga ?? '',
      originalTitle: movie.originalTitle ?? '',
      genreRaw: movie.genreRaw ?? '',
      director: movie.director ?? '',
      group: movie.group ?? '',
      seen: movie.seen ?? false,
      series: Boolean(movie.series),
      season: movie.season != null ? String(movie.season) : '',
      ratingGloria: movie.ratingGloria != null ? String(movie.ratingGloria) : '',
      ratingRodrigo: movie.ratingRodrigo != null ? String(movie.ratingRodrigo) : '',
      dubbing: typeof movie.dubbing === 'boolean' ? (movie.dubbing ? 'true' : 'false') : '',
      format: movie.format ?? '',
      region: movie.region ?? '',
      enDeposito: Boolean(movie.enDeposito),
      funcionaStatus: movie.funcionaStatus ?? 'untested'
    });
  }, [movie]);

  const seriesEpisodeCount = useMemo(() => {
    if (!movie) return null;
    const fromEpisodes = movie.seriesEpisodes?.length;
    if (fromEpisodes && fromEpisodes > 0) return fromEpisodes;
    if (!movie.tmdbSeasons?.length) return null;
    const total = movie.tmdbSeasons.reduce((sum, season) => sum + (season.episodeCount ?? 0), 0);
    return total > 0 ? total : null;
  }, [movie]);

  const seriesAiringStatus = useMemo(() => {
    if (!movie?.tmdbSeasons?.length) return 'Unknown';
    const now = new Date();
    const hasFuture = movie.tmdbSeasons.some((season) => {
      if (!season.airDate) return false;
      const parsed = new Date(season.airDate);
      return Number.isFinite(parsed.getTime()) && parsed > now;
    });
    return hasFuture ? 'Airing' : 'Ended';
  }, [movie]);

  useEffect(() => {
    return () => {
      if (redirectRef.current != null) {
        window.clearTimeout(redirectRef.current);
      }
    };
  }, []);

  const handleChange = (patch: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSubmit = async () => {
    if (!form || !movie || !adminSession) return;
    const seccion = form.seccion.trim();
    const title = form.title.trim();
    if (!seccion || !title) {
      setStatus('error');
      setError('Seccion y titulo son obligatorios.');
      return;
    }
    const year = parseNumber(form.year);
    if (form.year.trim() && year == null) {
      setStatus('error');
      setError('El año debe ser numerico.');
      return;
    }
    const season = parseNumber(form.season);
    if (form.season.trim() && season == null) {
      setStatus('error');
      setError('La temporada debe ser numerica.');
      return;
    }
    const ratingGloria = parseNumber(form.ratingGloria);
    if (form.ratingGloria.trim() && ratingGloria == null) {
      setStatus('error');
      setError('La puntuacion de Gloria debe ser numerica.');
      return;
    }
    const ratingRodrigo = parseNumber(form.ratingRodrigo);
    if (form.ratingRodrigo.trim() && ratingRodrigo == null) {
      setStatus('error');
      setError('La puntuacion de Rodrigo debe ser numerica.');
      return;
    }
    const dubbing = form.dubbing === '' ? null : form.dubbing === 'true';

    setStatus('saving');
    setError(null);
    try {
      await updateMovie({
        collectionId: movie.id,
        seccion,
        title,
        year,
        saga: form.saga.trim(),
        originalTitle: form.originalTitle.trim(),
        genreRaw: form.genreRaw.trim(),
        director: form.director.trim(),
        group: form.group.trim(),
        series: form.series,
        season: form.series ? season : null,
        seen: form.seen,
        ratingGloria,
        ratingRodrigo,
        dubbing,
        format: form.format.trim(),
        region: form.region.trim(),
        enDeposito: form.enDeposito,
        funcionaStatus: form.funcionaStatus
      });
      await refreshSupabase();
      setStatus('success');
      redirectRef.current = window.setTimeout(() => {
        navigate('/movies');
      }, 1600);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError('No se pudo guardar la pelicula.');
    }
  };

  if (!movie) {
    return (
      <section className="panel edit-page">
        <h1>Edit Title</h1>
        <p className="muted">No se encontro la pelicula solicitada.</p>
        <Link className="ghost" to="/movies">Volver al catalogo</Link>
      </section>
    );
  }

  if (!adminSession) {
    return (
      <section className="panel edit-page">
        <h1>Edit Title</h1>
        <p className="muted">Necesitas iniciar sesion admin para editar peliculas.</p>
        <Link className="ghost" to="/settings">Ir a configuracion</Link>
      </section>
    );
  }

  if (!form) return null;

  if (status === 'success') {
    return (
      <section className="panel edit-page edit-success">
        <div className="edit-success__icon">OK</div>
        <h1>Edicion completada</h1>
        <p className="muted">Los cambios ya estan en Supabase. Volviendo a la lista...</p>
        <div className="edit-success__actions">
          <button className="btn" type="button" onClick={() => navigate('/movies')}>
            Volver ahora
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel edit-page">
      <header className="edit-page__header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Edit Title</h1>
          <p className="muted">Update catalog record</p>
        </div>
        <div className="edit-page__actions">
          <Link className="ghost" to="/movies">Cancelar</Link>
          <button className="btn" type="button" onClick={handleSubmit} disabled={status === 'saving'}>
            {status === 'saving' ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </header>

      <div className="edit-hero">
        <div className="edit-hero__poster">
          <img
            src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
            alt={movie.title}
            loading="lazy"
          />
        </div>
        <div className="edit-hero__meta">
          <p className="eyebrow">Editando</p>
          <h2>{movie.title}</h2>
          <p className="muted">
            {movie.tmdbYear ?? movie.year ?? 'Year ?'} - {movie.seccion}
          </p>
          {movie.originalTitle && movie.originalTitle !== movie.title && (
            <p className="muted">Titulo original: {movie.originalTitle}</p>
          )}
          <div className="edit-hero__chips">
            {movie.seen && <span className="detail-sheet__chip detail-sheet__chip--accent">Vista</span>}
            {movie.enDeposito && <span className="detail-sheet__chip">En deposito</span>}
            <span className="detail-sheet__chip">
              {movie.series ? 'Serie' : 'Pelicula'}
            </span>
          </div>
        </div>
      </div>

      <div className="edit-form edit-form--catalog">
        <div className="catalog-layout">
          <div className="catalog-column">
            <div className="catalog-card catalog-card--sticky catalog-card--highlight">
              <div className="catalog-card__header">
                <h2>Catalog Structure</h2>
                <p className="muted">These values define which fields are available.</p>
              </div>
              <div className="catalog-card__body catalog-grid">
                <label>
                  <strong>Section (required)</strong>
                  <select
                    value={form.seccion}
                    onChange={(event) => handleChange({ seccion: event.target.value })}
                    required
                  >
                    <option value="">Selecciona seccion</option>
                    {sectionOptions.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <strong>Type (required)</strong>
                  <select
                    value={form.series ? 'series' : 'movie'}
                    onChange={(event) => handleChange({ series: event.target.value === 'series' })}
                  >
                    <option value="movie">Movie</option>
                    <option value="series">Series</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="catalog-card">
              <div className="catalog-card__header">
                <h3>Identity</h3>
              </div>
              <div className="catalog-card__body catalog-grid">
                <label>
                  <strong>Titulo</strong>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => handleChange({ title: event.target.value })}
                  />
                </label>
                <label>
                  <strong>Titulo original</strong>
                  <input
                    type="text"
                    value={form.originalTitle}
                    onChange={(event) => handleChange({ originalTitle: event.target.value })}
                  />
                </label>
                <label>
                  <strong>Saga</strong>
                  <input
                    type="text"
                    value={form.saga}
                    onChange={(event) => handleChange({ saga: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="catalog-card">
              <div className="catalog-card__header">
                <h3>Classification</h3>
              </div>
              <div className="catalog-card__body catalog-grid fade-swap" key={`${form.seccion}-${form.series ? 'series' : 'movie'}`}>
                <label>
                  <strong>Genero</strong>
                  <input
                    type="text"
                    value={form.genreRaw}
                    onChange={(event) => handleChange({ genreRaw: event.target.value })}
                  />
                </label>
                <label>
                  <strong>Grupo</strong>
                  <input
                    type="text"
                    value={form.group}
                    onChange={(event) => handleChange({ group: event.target.value })}
                  />
                </label>
                {form.series ? (
                  <>
                    <label>
                      <strong>Showrunner</strong>
                      <input
                        type="text"
                        value={form.director}
                        onChange={(event) => handleChange({ director: event.target.value })}
                      />
                    </label>
                    <label>
                      <strong>Seasons</strong>
                      <input
                        type="number"
                        value={form.season}
                        onChange={(event) => handleChange({ season: event.target.value })}
                      />
                    </label>
                    <label>
                      <strong>Episodes</strong>
                      <input type="text" value={seriesEpisodeCount ?? 'Unknown'} readOnly />
                    </label>
                    <label>
                      <strong>Airing Status</strong>
                      <input type="text" value={seriesAiringStatus} readOnly />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <strong>Director</strong>
                      <input
                        type="text"
                        value={form.director}
                        onChange={(event) => handleChange({ director: event.target.value })}
                      />
                    </label>
                    <label>
                      <strong>A??o</strong>
                      <input
                        type="number"
                        value={form.year}
                        onChange={(event) => handleChange({ year: event.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="catalog-column">
            {!form.series && (
              <div className="catalog-card">
                <div className="catalog-card__header">
                  <h3>Physical Copy (Movie only)</h3>
                </div>
                <div className="catalog-card__body catalog-grid">
                  <label>
                    <strong>Formato</strong>
                    <input
                      type="text"
                      value={form.format}
                      onChange={(event) => handleChange({ format: event.target.value })}
                    />
                  </label>
                  <label>
                    <strong>Regi??n</strong>
                    <input
                      type="text"
                      value={form.region}
                      onChange={(event) => handleChange({ region: event.target.value })}
                    />
                  </label>
                  <label>
                    <strong>Doblaje</strong>
                    <select
                      value={form.dubbing}
                      onChange={(event) => handleChange({ dubbing: event.target.value as FormState['dubbing'] })}
                    >
                      <option value="">No especificado</option>
                      <option value="true">S??</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            <div className="catalog-card">
              <div className="catalog-card__header">
                <h3>Item Status</h3>
              </div>
              <div className="catalog-card__body catalog-grid">
                <label>
                  <strong>Viewed</strong>
                  <input
                    type="checkbox"
                    checked={form.seen}
                    onChange={(event) => handleChange({ seen: event.target.checked })}
                  />
                </label>
                <label>
                  <strong>In Deposit</strong>
                  <input
                    type="checkbox"
                    checked={form.enDeposito}
                    onChange={(event) => handleChange({ enDeposito: event.target.checked })}
                  />
                </label>
                <label>
                  <strong>Playback Status</strong>
                  <select
                    value={form.funcionaStatus}
                    onChange={(event) => handleChange({ funcionaStatus: event.target.value as FormState['funcionaStatus'] })}
                  >
                    <option value="working">Funciona</option>
                    <option value="damaged">Danada</option>
                    <option value="untested">Sin probar</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="catalog-card">
              <div className="catalog-card__header">
                <h3>Ratings</h3>
              </div>
              <div className="catalog-card__body catalog-grid">
                <label>
                  <strong>Puntuacion Gloria</strong>
                  <input
                    type="number"
                    step="0.5"
                    value={form.ratingGloria}
                    onChange={(event) => handleChange({ ratingGloria: event.target.value })}
                  />
                </label>
                <label>
                  <strong>Puntuacion Rodrigo</strong>
                  <input
                    type="number"
                    step="0.5"
                    value={form.ratingRodrigo}
                    onChange={(event) => handleChange({ ratingRodrigo: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {status === 'error' && <p className="muted edit-form__error">{error}</p>}
      </div></div>
    </section>
  );
};
