import { CuratorMoviePayload } from './collectionCurator';

export type CuratorRecommendation = {
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

export type CuratorResponse = {
  answer: string;
  recommendations: CuratorRecommendation[];
  extractedActor?: string | null;
  model?: string;
};

export async function askCollectionCurator(payload: {
  query: string;
  movies: CuratorMoviePayload[];
}): Promise<CuratorResponse> {
  const response = await fetch('/api/curator/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as CuratorResponse | { error?: string }) : null;

  if (!response.ok) {
    throw new Error((parsed && 'error' in parsed && parsed.error) || `Error ${response.status}`);
  }

  return parsed as CuratorResponse;
}
