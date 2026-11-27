import { getOrSetCache } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { getMeiliClient } from '@/lib/meili';
import { MOVIES_INDEX, MovieSearchDocument } from '@/services/search-indexer';

export interface SearchMoviesParams {
  q?: string;
  country?: string;
  year?: number | null;
  genre?: string;
  language?: string;
  platformId?: number | null;
  offerType?: string;
  page?: number;
  limit?: number;
}

export function buildMeiliFilter(params: SearchMoviesParams): string[] {
  const filters: string[] = [];
  const country = (params.country ?? 'IN').trim().toUpperCase();

  if (params.year && Number.isFinite(params.year)) {
    filters.push(`year = ${params.year}`);
  }
  if (params.genre?.trim()) {
    filters.push(`genreSlugs = "${params.genre.trim().replace(/"/g, '')}"`);
  }
  if (params.language?.trim()) {
    filters.push(`languages = "${params.language.trim().toLowerCase().replace(/"/g, '')}"`);
  }

  const offerType = params.offerType?.trim().toLowerCase();
  if (params.platformId && offerType) {
    filters.push(`availabilityKeys = "${country}:${params.platformId}:${offerType}"`);
  } else if (params.platformId) {
    filters.push(`availabilityKeys = "${country}:${params.platformId}"`);
  } else if (offerType) {
    filters.push(`availabilityKeys = "${country}:${offerType}"`);
  }

  return filters;
}

export interface SearchMoviesResponse {
  hits: Array<{
    id: number;
    tmdbId: number;
    title: string;
    slug: string;
    year: number | null;
    runtime: number | null;
    posterPath: string | null;
    voteAverage: number;
    genres: string[];
    platforms: Array<{
      id: number;
      name: string;
      slug: string;
      logoPath: string | null;
      offerType: string;
    }>;
  }>;
  totalHits: number;
  page: number;
  limit: number;
  processingTimeMs: number;
}

export async function searchMovies(params: SearchMoviesParams): Promise<SearchMoviesResponse> {
  const country = (params.country ?? 'IN').trim().toUpperCase();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(48, Math.max(1, params.limit ?? 24));
  const query = (params.q ?? '').trim();
  const filter = buildMeiliFilter({ ...params, country });

  const meili = getMeiliClient();
  const index = meili.index<MovieSearchDocument>(MOVIES_INDEX);

  const result = await index.search(query, {
    filter: filter.length > 0 ? filter : undefined,
    sort: query ? undefined : ['popularity:desc'],
    offset: (page - 1) * limit,
    limit,
  });

  const hits = result.hits.map((doc) => {
    const rawPlatforms = doc.platformsByCountry?.[country] ?? [];
    // Deduplicate platforms by id for card display
    const seen = new Set<number>();
    const platforms = rawPlatforms.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return {
      id: doc.id,
      tmdbId: doc.tmdbId,
      title: doc.title,
      slug: doc.slug,
      year: doc.year,
      runtime: doc.runtime,
      posterPath: doc.posterPath,
      voteAverage: doc.voteAverage,
      genres: doc.genres,
      platforms,
    };
  });

  return {
    hits,
    totalHits: result.estimatedTotalHits ?? hits.length,
    page,
    limit,
    processingTimeMs: result.processingTimeMs,
  };
}

export async function getFilterOptions(countryCode = 'IN') {
  const country = countryCode.trim().toUpperCase();

  return getOrSetCache(`wtw:filters:${country}`, 600, async () => {
    const [genres, platforms] = await Promise.all([
      prisma.genre.findMany({
        orderBy: { name: 'asc' },
        select: { name: true, slug: true },
      }),
      prisma.platform.findMany({
        where: {
          availability: {
            some: { countryCode: country },
          },
        },
        orderBy: [{ displayPriority: 'asc' }, { name: 'asc' }],
        take: 30,
        select: { id: true, name: true, slug: true, logoPath: true },
      }),
    ]);

    return { genres, platforms };
  });
}
