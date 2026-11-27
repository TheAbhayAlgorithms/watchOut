import { TmdbClient, TmdbCountryWatchProviders, TmdbProviderItem } from '@/providers/tmdb-client';
import { AvailabilityProvider, AvailabilityResult, NormalizedOffer, OfferType } from '@/providers/types';

export function normalizeTmdbWatchProviders(
  results: Record<string, TmdbCountryWatchProviders>,
  countries: string[]
): NormalizedOffer[] {
  const offers: NormalizedOffer[] = [];
  const seen = new Set<string>();

  for (const rawCountry of countries) {
    const countryCode = rawCountry.trim().toUpperCase();
    const countryData = results[countryCode];
    if (!countryData) continue;

    const deepLink = countryData.link ?? null;

    const buckets: Array<{ offerType: OfferType; items?: TmdbProviderItem[] }> = [
      { offerType: 'sub', items: countryData.flatrate },
      { offerType: 'free', items: countryData.free },
      { offerType: 'free', items: countryData.ads },
      { offerType: 'rent', items: countryData.rent },
      { offerType: 'buy', items: countryData.buy },
    ];

    for (const bucket of buckets) {
      for (const item of bucket.items ?? []) {
        const dedupeKey = `${countryCode}:${item.provider_id}:${bucket.offerType}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        offers.push({
          providerExternalId: item.provider_id,
          providerName: item.provider_name,
          providerLogoPath: item.logo_path ?? null,
          displayPriority: item.display_priority ?? 100,
          countryCode,
          offerType: bucket.offerType,
          price: null,
          currency: null,
          deepLink,
        });
      }
    }
  }

  return offers;
}

export class TmdbJustWatchProvider implements AvailabilityProvider {
  public readonly name = 'tmdb_justwatch';
  private readonly client: TmdbClient;

  constructor(client = new TmdbClient()) {
    this.client = client;
  }

  public async fetchMovieAvailability(
    identifiers: { tmdbId: number; imdbId?: string | null },
    countries: string[]
  ): Promise<AvailabilityResult> {
    const response = await this.client.getWatchProviders(identifiers.tmdbId);
    const offers = normalizeTmdbWatchProviders(response.results ?? {}, countries);

    return {
      source: this.name,
      offers,
      checkedAt: new Date(),
    };
  }
}
