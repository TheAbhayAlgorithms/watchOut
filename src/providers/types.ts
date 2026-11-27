export type OfferType = 'sub' | 'free' | 'rent' | 'buy';

export interface NormalizedOffer {
  providerExternalId: number;
  providerName: string;
  providerLogoPath: string | null;
  displayPriority: number;
  countryCode: string; // ISO 3166-1 alpha-2 uppercase (e.g. IN, US, GB)
  offerType: OfferType;
  price: number | null;
  currency: string | null;
  deepLink: string | null;
}

export interface AvailabilityResult {
  source: string;
  offers: NormalizedOffer[];
  checkedAt: Date;
}

export interface AvailabilityProvider {
  readonly name: string;
  fetchMovieAvailability(
    identifiers: { tmdbId: number; imdbId?: string | null },
    countries: string[]
  ): Promise<AvailabilityResult>;
}
