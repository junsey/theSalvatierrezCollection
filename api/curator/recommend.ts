import { fetchTmdbPersonKnownTitles, searchTmdbPerson } from '../lib/tmdb.js';
import { readJsonBody, reject } from '../lib/admin.js';

type CuratorMovie = {
  id: string;
  title: string;
  originalTitle?: string;
  director: string;
  genreRaw: string;
  seccion: string;
  saga: string;
  group: string;
  series?: boolean;
  season?: number | null;
  year: number | null;
  seen: boolean;
  enDeposito?: boolean;
  funcionaStatus: 'working' | 'damaged' | 'untested';
  ratingGloria?: number | null;
  ratingRodrigo?: number | null;
  tmdbRating?: number | null;
  tmdbGenres?: string[];
  format: string;
  region?: string;
  dubbing?: boolean | string | null;
  plot?: string;
  tmdbId?: number;
};

type Recommendation = {
  id: string;
  title: string;
  year: number | null;
  director: string;
  reason: string;
  seen: boolean;
  enDeposito?: boolean;
  funcionaStatus: 'working' | 'damaged' | 'untested';
  matchScore: number;
  seccion: string;
  genreLabel: string;
  format: string;
  saga?: string;
  plotSnippet?: string;
  tmdbGenres?: string[];
  houseRating?: string;
  detailBullets: string[];
};

const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TOKEN_REGEX = /[\p{L}\p{N}]+/gu;
const STOP_WORDS = new Set([
  'a', 'algo', 'algun', 'alguna', 'algunas', 'algunos', 'con', 'de', 'del', 'el', 'en', 'esta',
  'este', 'hoy', 'la', 'las', 'lo', 'los', 'me', 'mi', 'muy', 'para', 'peli', 'pelicula',
  'películas', 'peliculas', 'por', 'que', 'quiero', 'recomiendame', 'recomiéndame', 'serie',
  'series', 'su', 'sus', 'tipo', 'una', 'uno', 'unos', 'unas', 'ver', 'ya'
]);

const normalize = (value: string | undefined | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const tokenize = (value: string) =>
  (normalize(value).match(TOKEN_REGEX) ?? []).filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const getSeenPreference = (query: string) => {
  const normalized = normalize(query);
  if (/(no haya visto|sin ver|no vi|no vimos|pendiente|nueva para mi|nuevo para mi)/.test(normalized)) return 'unseen' as const;
  if (/(ya vi|ya vimos|vista|vistas|que vimos|he visto)/.test(normalized)) return 'seen' as const;
  return 'any' as const;
};

const getSeriesPreference = (query: string) => {
  const normalized = normalize(query);
  if (/(serie|temporada|episodio|capitulo)/.test(normalized)) return 'series' as const;
  if (/(peli|pelicula|film|cine)/.test(normalized)) return 'movies' as const;
  return 'any' as const;
};

const getConditionPreference = (query: string) => {
  const normalized = normalize(query);
  if (/(danad|rota|roto|no funciona)/.test(normalized)) return 'damaged' as const;
  if (/(sin probar|no probad|untested)/.test(normalized)) return 'untested' as const;
  if (/(funcion|anda bien|que ande|que funcione)/.test(normalized)) return 'working' as const;
  return 'any' as const;
};

const extractLikelyActor = (query: string) => {
  const patterns = [
    /(?:actor|actriz)\s+([^,.!?]+)/iu,
    /(?:con|sale|salga|aparece|aparezca)\s+([^,.!?]+)/iu
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match) continue;
    const value = match[1]
      .replace(/^(el|la|los|las)\s+/iu, '')
      .replace(/\b(que|y|o|pero)\b.*$/iu, '')
      .trim();
    if (value.split(/\s+/).length >= 2) return value;
  }

  return null;
};

const formatHouseRating = (movie: CuratorMovie) => {
  const parts = [
    movie.ratingGloria != null ? `Gloria ${movie.ratingGloria}` : null,
    movie.ratingRodrigo != null ? `Rodrigo ${movie.ratingRodrigo}` : null
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(' · ') : undefined;
};

const buildSearchBlob = (movie: CuratorMovie) =>
  [
    movie.title,
    movie.originalTitle,
    movie.director,
    movie.genreRaw,
    movie.seccion,
    movie.saga,
    movie.group,
    movie.format,
    movie.region,
    movie.dubbing == null ? '' : String(movie.dubbing),
    movie.plot,
    ...(movie.tmdbGenres ?? [])
  ]
    .filter(Boolean)
    .join(' | ');

const buildDetailBullets = (movie: CuratorMovie, actorMatch: boolean) => {
  const details: string[] = [];
  if (actorMatch) details.push('Coincide con el actor pedido.');
  if (movie.seccion) details.push(`Pertenece a la sección ${movie.seccion}.`);
  if (movie.genreRaw) details.push(`Género base: ${movie.genreRaw}.`);
  if (movie.tmdbGenres?.length) details.push(`TMDb la clasifica como ${movie.tmdbGenres.join(', ')}.`);
  if (movie.saga) details.push(`Forma parte de la saga ${movie.saga}.`);
  if (movie.format) details.push(`Está disponible en formato ${movie.format}.`);
  if (movie.region) details.push(`Región: ${movie.region}.`);
  if (movie.enDeposito) details.push('Actualmente figura en depósito.');
  details.push(
    movie.seen ? 'Ya está marcada como vista en la colección.' : 'Todavía no está marcada como vista en la colección.'
  );
  details.push(
    movie.funcionaStatus === 'working'
      ? 'Figura como funcionando correctamente.'
      : movie.funcionaStatus === 'damaged'
        ? 'Figura como dañada.'
        : 'Todavía está sin probar.'
  );
  const houseRating = formatHouseRating(movie);
  if (houseRating) details.push(`Rating de la casa: ${houseRating}.`);
  return details.slice(0, 6);
};

const buildRecommendationReason = (movie: CuratorMovie, query: string, actorMatch: boolean) => {
  const pieces: string[] = [];
  if (actorMatch) pieces.push('coincide con el actor pedido');
  if (movie.seccion) pieces.push(`entra en la sección ${movie.seccion}`);
  if (movie.genreRaw) pieces.push(`se mueve en ${movie.genreRaw}`);
  if (movie.plot) pieces.push(`su ficha apunta a “${movie.plot}”`);
  if (!movie.seen) pieces.push('sigue pendiente de ver');
  if (movie.seen) pieces.push('ya consta como vista');
  if (movie.funcionaStatus === 'working') pieces.push('figura como funcionando');
  if (movie.enDeposito) pieces.push('pero ahora mismo está en depósito');
  if (!pieces.length) pieces.push(`encaja con la búsqueda: ${query}`);
  return pieces.slice(0, 4).join(' · ');
};

const scoreMovie = (
  movie: CuratorMovie,
  query: string,
  tokens: string[],
  actorTitleIds: Set<number>,
  seenPreference: ReturnType<typeof getSeenPreference>,
  seriesPreference: ReturnType<typeof getSeriesPreference>,
  conditionPreference: ReturnType<typeof getConditionPreference>
) => {
  const blob = normalize(buildSearchBlob(movie));
  const plot = normalize(movie.plot);
  const section = normalize(movie.seccion);
  const genre = normalize(`${movie.genreRaw} ${(movie.tmdbGenres ?? []).join(' ')}`);
  const saga = normalize(movie.saga);
  const format = normalize(movie.format);
  let score = 0;
  const exactQuery = normalize(query).trim();
  if (exactQuery && blob.includes(exactQuery)) score += 14;

  tokens.forEach((token) => {
    if (blob.includes(token)) score += 2;
    if (normalize(movie.title).includes(token)) score += 4;
    if (normalize(movie.director).includes(token)) score += 4;
    if (section.includes(token)) score += 4.5;
    if (genre.includes(token)) score += 3.5;
    if (saga.includes(token)) score += 3;
    if (format.includes(token)) score += 2;
    if (plot.includes(token)) score += 2.5;
  });

  if (movie.tmdbId && actorTitleIds.has(movie.tmdbId)) {
    score += 18;
  }

  if (seenPreference === 'unseen') score += movie.seen ? -6 : 7;
  if (seenPreference === 'seen') score += movie.seen ? 6 : -3;

  if (seriesPreference === 'series') score += movie.series ? 6 : -2;
  if (seriesPreference === 'movies') score += movie.series ? -2 : 6;

  if (conditionPreference === 'working') score += movie.funcionaStatus === 'working' ? 4 : -3;
  if (conditionPreference === 'damaged') score += movie.funcionaStatus === 'damaged' ? 4 : -4;
  if (conditionPreference === 'untested') score += movie.funcionaStatus === 'untested' ? 4 : -2;

  if (movie.enDeposito) score -= 2;
  if (movie.funcionaStatus === 'damaged') score -= 3;
  if (movie.funcionaStatus === 'working') score += 1;

  const houseAverage = [movie.ratingGloria, movie.ratingRodrigo].filter(
    (value): value is number => typeof value === 'number'
  );
  if (houseAverage.length > 0) {
    score += houseAverage.reduce((sum, value) => sum + value, 0) / houseAverage.length / 3;
  }
  if (typeof movie.tmdbRating === 'number') score += movie.tmdbRating / 10;

  return score;
};

const buildGroqAnswer = async (query: string, recommendations: Recommendation[], extractedActor?: string | null) => {
  if (!GROQ_API_KEY) {
    throw new Error('Falta configurar GROQ_API_KEY en el servidor.');
  }

  const system = [
    'Eres el curador de The Salvatierrez Collection.',
    'Respondes siempre en español.',
    'Solo puedes recomendar títulos presentes en la lista de recomendaciones proporcionada.',
    'Debes apoyar tu recomendación en detalles de ficha: sección, sinopsis, saga, formato, géneros y estado dentro de la colección.',
    'Debes mencionar si una película está vista, en depósito o dañada cuando sea relevante.',
    'Si no hay coincidencia perfecta, dilo con honestidad y ofrece la mejor alternativa de la colección.',
    'Sé breve pero útil: máximo 170 palabras.'
  ].join(' ');

  const user = JSON.stringify({
    query,
    extractedActor: extractedActor ?? null,
    recommendations
  });

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.35,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq devolvió ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error('Groq no devolvió una respuesta utilizable.');
  }
  return answer;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return reject(res, 405, 'Metodo no permitido.');
  }

  try {
    const body = await readJsonBody(req);
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const movies = Array.isArray(body.movies) ? (body.movies as CuratorMovie[]) : [];

    if (!query) {
      return reject(res, 400, 'La consulta es obligatoria.');
    }

    if (!movies.length) {
      return reject(res, 400, 'La colección está vacía.');
    }

    const tokens = tokenize(query);
    const extractedActor = extractLikelyActor(query);
    let actorTitleIds = new Set<number>();

    if (extractedActor) {
      try {
        const person = await searchTmdbPerson(extractedActor);
        if (person) {
          const titles = await fetchTmdbPersonKnownTitles(person.id);
          actorTitleIds = new Set(titles.map((item) => item.id));
        }
      } catch (error) {
        console.warn('No se pudo enriquecer la búsqueda por actor', error);
      }
    }

    const seenPreference = getSeenPreference(query);
    const seriesPreference = getSeriesPreference(query);
    const conditionPreference = getConditionPreference(query);

    const ranked = movies
      .map((movie) => ({
        movie,
        score: scoreMovie(movie, query, tokens, actorTitleIds, seenPreference, seriesPreference, conditionPreference)
      }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const recommendations: Recommendation[] = ranked.map(({ movie, score }) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      director: movie.director,
      reason: buildRecommendationReason(movie, query, Boolean(movie.tmdbId && actorTitleIds.has(movie.tmdbId))),
      seen: movie.seen,
      enDeposito: movie.enDeposito,
      funcionaStatus: movie.funcionaStatus,
      matchScore: Number(score.toFixed(2)),
      seccion: movie.seccion,
      genreLabel: movie.genreRaw || movie.tmdbGenres?.join(', ') || 'Sin género',
      format: movie.format,
      saga: movie.saga || undefined,
      plotSnippet: movie.plot,
      tmdbGenres: movie.tmdbGenres,
      houseRating: formatHouseRating(movie),
      detailBullets: buildDetailBullets(movie, Boolean(movie.tmdbId && actorTitleIds.has(movie.tmdbId)))
    }));

    if (recommendations.length === 0) {
      return res.status(200).json({
        answer:
          'No encontré coincidencias claras en la colección con esa búsqueda. Prueba con un actor, sección, género, saga o si la quieres vista/sin ver.',
        recommendations: [],
        extractedActor: extractedActor ?? null,
        model: GROQ_MODEL
      });
    }

    const answer = await buildGroqAnswer(query, recommendations, extractedActor);

    return res.status(200).json({
      answer,
      recommendations,
      extractedActor: extractedActor ?? null,
      model: GROQ_MODEL
    });
  } catch (error) {
    console.error('Curator recommendation failed', error);
    const message = error instanceof Error ? error.message : 'No se pudo consultar al curador.';
    return reject(res, 500, message);
  }
}
