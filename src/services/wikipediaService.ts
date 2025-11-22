const WIKI_SEARCH_URL = 'https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&origin=*';

export async function searchWikipediaArticle(title: string): Promise<string | null> {
  if (!title) return null;
  const url = `${WIKI_SEARCH_URL}&search=${encodeURIComponent(title)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as [string, string[], string[], string[]];
    const bestTitle = data?.[1]?.[0];
    return bestTitle ?? null;
  } catch (error) {
    console.warn('Fallo al buscar en Wikipedia', error);
    return null;
  }
}

export async function getWikipediaSummaryAndThumbnail(articleTitle: string): Promise<{ summary: string | null; thumbnailUrl: string | null }> {
  if (!articleTitle) return { summary: null, thumbnailUrl: null };
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|extracts&titles=${encodeURIComponent(
    articleTitle
  )}&format=json&exintro=1&explaintext=1&pithumbsize=400&origin=*`;

  try {
    const response = await fetch(url);
    if (!response.ok) return { summary: null, thumbnailUrl: null };
    const data = (await response.json()) as any;
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    const summary = page?.extract ?? null;
    const thumbnailUrl = page?.thumbnail?.source ?? null;
    return { summary, thumbnailUrl };
  } catch (error) {
    console.warn('Fallo al obtener extracto de Wikipedia', error);
    return { summary: null, thumbnailUrl: null };
  }
}
