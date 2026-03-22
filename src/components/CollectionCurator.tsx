import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import { buildCuratorPayload } from '../services/collectionCurator';
import { askCollectionCurator, CuratorResponse } from '../services/curatorApi';
import { setStoredFilters } from '../services/localStorage';

const starterPrompts = [
  'Quiero una peli que no haya visto todavía.',
  'Recomiéndame algo de ciencia ficción que esté funcionando bien.',
  '¿Qué hay en la colección con Tom Hanks?',
  'Busco algo de la sección de thriller o misterio para hoy.'
];

const statusLabel: Record<MovieRecord['funcionaStatus'], string> = {
  working: 'Funciona',
  damaged: 'Dañada',
  untested: 'Sin probar'
};

export const CollectionCurator: React.FC<{ movies: MovieRecord[]; loading: boolean }> = ({
  movies,
  loading
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CuratorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const payload = useMemo(() => buildCuratorPayload(movies), [movies]);

  const openMovie = (title: string) => {
    setStoredFilters({
      query: title,
      seccion: null,
      genre: null,
      saga: null,
      series: 'all',
      seen: 'all',
      condition: 'all',
      deposit: 'all',
      view: 'grid',
      sort: 'title-asc'
    });
    navigate('/movies');
  };

  const submitQuery = async (customQuery?: string) => {
    const nextQuery = (customQuery ?? query).trim();
    if (!nextQuery) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await askCollectionCurator({ query: nextQuery, movies: payload });
      setResult(response);
      setQuery(nextQuery);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo consultar al curador.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="curator-section">
      <div className="curator-section__copy">
        <div>
          <p className="eyebrow">Curador IA</p>
          <h2>Pregúntale al curador de la colección</h2>
        </div>
        <p className="lore">
          Ahora el curador tiene en cuenta también la sección, sinopsis, formato, saga, géneros y
          otros detalles de cada ficha para recomendar solo lo que ya existe dentro del archivo.
        </p>
      </div>

      <div className="curator-shell">
        <form
          className="curator-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuery();
          }}
        >
          <textarea
            className="curator-form__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej.: quiero algo de la sección western, con buen rating y que no hayamos visto"
            rows={4}
            disabled={loading || submitting}
          />
          <div className="curator-form__actions">
            <button type="submit" className="nav-link nav-link--solid" disabled={loading || submitting || !query.trim()}>
              {submitting ? 'Consultando…' : 'Consultar al curador'}
            </button>
            <Link to="/movies" className="nav-link nav-link--ghost">
              Ver toda la colección
            </Link>
          </div>
        </form>

        <div className="curator-prompts">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="curator-chip"
              onClick={() => void submitQuery(prompt)}
              disabled={loading || submitting}
            >
              {prompt}
            </button>
          ))}
        </div>

        {error && <p className="curator-error">{error}</p>}

        <div className="curator-panel">
          {!result ? (
            <p className="muted">
              {loading
                ? 'Esperando la colección para activar al curador…'
                : 'Pregúntale por actores, secciones, géneros, estado de visionado o cualquier detalle de la ficha.'}
            </p>
          ) : (
            <>
              <div className="curator-answer">
                <p>{result.answer}</p>
                {result.extractedActor ? (
                  <span className="curator-meta">Actor detectado: {result.extractedActor}</span>
                ) : null}
                {result.model ? <span className="curator-meta">Modelo: {result.model}</span> : null}
              </div>

              <div className="curator-results">
                {result.recommendations.map((recommendation) => (
                  <article key={recommendation.id} className="curator-result-card">
                    <div>
                      <h3>
                        {recommendation.title}
                        {recommendation.year ? <span> ({recommendation.year})</span> : null}
                      </h3>
                      <p className="curator-result-card__director">{recommendation.director || 'Dirección no informada'}</p>
                    </div>

                    <div className="curator-result-card__meta-grid">
                      <span className="curator-detail-pill">Sección: {recommendation.seccion || 'Sin sección'}</span>
                      <span className="curator-detail-pill">Formato: {recommendation.format || 'Sin formato'}</span>
                      <span className="curator-detail-pill">Género: {recommendation.genreLabel || 'Sin género'}</span>
                      {recommendation.saga ? <span className="curator-detail-pill">Saga: {recommendation.saga}</span> : null}
                      {recommendation.houseRating ? (
                        <span className="curator-detail-pill">Rating casa: {recommendation.houseRating}</span>
                      ) : null}
                    </div>

                    <p className="curator-result-card__reason">{recommendation.reason}</p>
                    {recommendation.plotSnippet ? (
                      <p className="curator-result-card__plot">{recommendation.plotSnippet}</p>
                    ) : null}

                    <ul className="curator-result-card__details">
                      {recommendation.detailBullets.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>

                    <div className="curator-result-card__badges">
                      <span className="status-pill">{recommendation.seen ? 'Vista' : 'Sin ver'}</span>
                      {recommendation.enDeposito ? <span className="status-pill">En depósito</span> : null}
                      <span className="status-pill">{statusLabel[recommendation.funcionaStatus]}</span>
                    </div>
                    <button
                      type="button"
                      className="curator-result-card__cta"
                      onClick={() => openMovie(recommendation.title)}
                    >
                      Abrir en la colección
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
