import { logger } from '@/lib/logger';
import { AvailabilityProvider, AvailabilityResult, NormalizedOffer, OfferType } from '@/providers/types';

const WATCHMODE_BASE_URL = 'https://api.watchmode.com/v1';

export interface WatchmodeSourceItem {
  source_id: number;
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free' | 'tve' | string;
  region: string;
  web_url?: string | null;
  price?: number | null;
  format?: string | null;
}

export class WatchmodeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WatchmodeConfigError';
  }
}

function mapWatchmodeOfferType(rawType: string): OfferType | null {
  switch (rawType.toLowerCase()) {
    case 'sub':
      return 'sub';
    case 'free':
    case 'tve':
      return 'free';
    case 'rent':
      return 'rent';
    case 'buy':
      return 'buy';
    default:
      return null;
  }
}

export function normalizeWatchmodeSources(
  sources: WatchmodeSourceItem[],
  countries: string[]
): NormalizedOffer[] {
  const allowed = new Set(countries.map((c) => c.trim().toUpperCase()));
  const offers: NormalizedOffer[] = [];
  const seen = new Set<string>();

  for (const item of sources) {
    const countryCode = item.region?.trim().toUpperCase();
    if (!countryCode || !allowed.has(countryCode)) continue;

    const offerType = mapWatchmodeOfferType(item.type);
    if (!offerType) continue;

    // Offset Watchmode source IDs by 1_000_000 to avoid colliding with TMDB provider IDs
    const providerExternalId = 1_000_000 + item.source_id;
    const dedupeKey = `${countryCode}:${providerExternalId}:${offerType}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    offers.push({
      providerExternalId,
      providerName: item.name,
      providerLogoPath: null,
      displayPriority: 50,
      countryCode,
      offerType,
      price: item.price ?? null,
      currency: null,
      deepLink: item.web_url ?? null,
    });
  }

  return offers;
}

export class WatchmodeAvailabilityProvider implements AvailabilityProvider {
  public readonly name = 'watchmode';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey ?? process.env.WATCHMODE_API_KEY ?? '').trim();
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async resolveWatchmodeTitleId(identifiers: {
    tmdbId: number;
    imdbId?: string | null;
  }): Promise<string | number | null> {
    if (identifiers.imdbId) {
      return identifiers.imdbId;
    }

    const searchUrl = new URL(`${WATCHMODE_BASE_URL}/search/`);
    searchUrl.searchParams.set('apiKey', this.apiKey);
    searchUrl.searchParams.set('search_field', 'tmdb_movie_id');
    searchUrl.searchParams.set('search_value', String(identifiers.tmdbId));

    const res = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { title_results?: Array<{ id: number }> };
    return data.title_results?.[0]?.id ?? null;
  }

  public async fetchMovieAvailability(
    identifiers: { tmdbId: number; imdbId?: string | null },
    countries: string[]
  ): Promise<AvailabilityResult> {
    if (!this.isConfigured()) {
      throw new WatchmodeConfigError(
        'WATCHMODE_API_KEY is missing. Set it in .env to use the Watchmode provider.'
      );
    }

    const titleId = await this.resolveWatchmodeTitleId(identifiers);
    if (!titleId) {
      return { source: this.name, offers: [], checkedAt: new Date() };
    }

    const url = new URL(`${WATCHMODE_BASE_URL}/title/${titleId}/sources/`);
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set('regions', countries.map((c) => c.trim().toUpperCase()).join(','));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      logger.warn({ status: res.status, titleId }, 'Watchmode sources request failed');
      throw new Error(`Watchmode HTTP ${res.status}`);
    }

    const sources = (await res.json()) as WatchmodeSourceItem[];
    const offers = normalizeWatchmodeSources(Array.isArray(sources) ? sources : [], countries);

    return {
      source: this.name,
      offers,
      checkedAt: new Date(),
    };
  }
}
