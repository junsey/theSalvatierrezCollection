// Compatibilidad heredada: este archivo evita errores cuando ramas antiguas
// referencian la antigua API de IMDb/OMDb. Todos los enriquecimientos se
// delegan al cliente de TMDb para cumplir con el requisito actual.
// No realiza llamadas a IMDb ni a OMDb.

export { enrichMoviesBatch } from './tmdbApi';
export type { TmdbEnrichment as ImdbEnrichment } from './tmdbApi';
