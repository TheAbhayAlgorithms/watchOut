import { logger } from '@/lib/logger';

export interface OmdbRatings {
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
}

interface OmdbApiResponse {
  Response: 'True' | 'False';
  imdbRating?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
}

export async function fetchOmdbRatings(imdbId: string): Promise<OmdbRatings | null> {
  const apiKey = process.env.OMDB_API_KEY?.trim();
  if (!apiKey || !imdbId) return null;

  try {
    const url = new URL('https://www.omdbapi.com/');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('i', imdbId);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = (await res.json()) as OmdbApiResponse;
    if (data.Response !== 'True') return null;

    const parsedImdb = data.imdbRating ? Number.parseFloat(data.imdbRating) : NaN;
    const imdbRating = Number.isFinite(parsedImdb) ? parsedImdb : null;

    const rtEntry = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const rtMatch = rtEntry?.Value.match(/(\d+)%/);
    const rottenTomatoesScore = rtMatch?.[1] ? Number.parseInt(rtMatch[1], 10) : null;

    return { imdbRating, rottenTomatoesScore };
  } catch (err) {
    logger.warn({ imdbId, err }, 'Failed to fetch optional OMDb ratings');
    return null;
  }
}
