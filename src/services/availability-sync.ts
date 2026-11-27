import { OfferType, PlatformType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { slugify } from '@/lib/slug';
import { TmdbJustWatchProvider } from '@/providers/tmdb-availability';
import { AvailabilityProvider, NormalizedOffer } from '@/providers/types';
import { WatchmodeAvailabilityProvider } from '@/providers/watchmode-availability';

export function getDefaultAvailabilityProvider(preferred?: string): AvailabilityProvider {
  if (preferred === 'watchmode') return new WatchmodeAvailabilityProvider();
  if (preferred === 'tmdb') return new TmdbJustWatchProvider();
  if (!process.env.TMDB_API_KEY && !process.env.TMDB_READ_ACCESS_TOKEN && process.env.WATCHMODE_API_KEY) {
    return new WatchmodeAvailabilityProvider();
  }
  return new TmdbJustWatchProvider();
}

export const DEFAULT_AVAILABILITY_COUNTRIES = ['IN', 'US', 'GB'];

function inferPlatformType(offerTypes: Set<OfferType>): PlatformType {
  if (offerTypes.size > 1) return PlatformType.mixed;
  if (offerTypes.has(OfferType.sub)) return PlatformType.subscription;
  if (offerTypes.has(OfferType.free)) return PlatformType.free;
  if (offerTypes.has(OfferType.rent) || offerTypes.has(OfferType.buy)) {
    return PlatformType.transactional;
  }
  return PlatformType.mixed;
}

export async function upsertMovieAvailability(
  movieId: number,
  identifiers: { tmdbId: number; imdbId?: string | null },
  countries: string[],
  provider: AvailabilityProvider = new TmdbJustWatchProvider()
): Promise<{ offersCount: number }> {
  const normalizedCountries = countries.map((c) => c.trim().toUpperCase()).filter(Boolean);
  const result = await provider.fetchMovieAvailability(identifiers, normalizedCountries);

  // Group offers by providerExternalId to upsert platforms once
  const providerOffersMap = new Map<number, NormalizedOffer[]>();
  for (const offer of result.offers) {
    const list = providerOffersMap.get(offer.providerExternalId) ?? [];
    list.push(offer);
    providerOffersMap.set(offer.providerExternalId, list);
  }

  const platformIdByExternal = new Map<number, number>();
  for (const [externalId, offers] of providerOffersMap.entries()) {
    const sample = offers[0];
    if (!sample) continue;
    const offerTypes = new Set(offers.map((o) => o.offerType as OfferType));
    const platformType = inferPlatformType(offerTypes);

    const platform = await prisma.platform.upsert({
      where: { tmdbProviderId: externalId },
      update: {
        name: sample.providerName,
        logoPath: sample.providerLogoPath,
        displayPriority: sample.displayPriority,
      },
      create: {
        tmdbProviderId: externalId,
        name: sample.providerName,
        slug: `${slugify(sample.providerName)}-${externalId}`,
        logoPath: sample.providerLogoPath,
        type: platformType,
        displayPriority: sample.displayPriority,
      },
      select: { id: true },
    });
    platformIdByExternal.set(externalId, platform.id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({
      where: {
        movieId,
        countryCode: { in: normalizedCountries },
        source: result.source,
      },
    });

    if (result.offers.length > 0) {
      await tx.availability.createMany({
        data: result.offers
          .map((offer) => {
            const platformId = platformIdByExternal.get(offer.providerExternalId);
            if (!platformId) return null;
            return {
              movieId,
              platformId,
              countryCode: offer.countryCode,
              offerType: offer.offerType as OfferType,
              price: offer.price,
              currency: offer.currency,
              deepLink: offer.deepLink,
              source: result.source,
              lastCheckedAt: result.checkedAt,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null),
        skipDuplicates: true,
      });
    }
  });

  return { offersCount: result.offers.length };
}

export async function syncAvailabilityForCatalog(options?: {
  countries?: string[];
  limit?: number;
  concurrency?: number;
  provider?: AvailabilityProvider;
}): Promise<{ moviesProcessed: number; offersSaved: number; failed: number }> {
  const countries = options?.countries?.length
    ? options.countries.map((c) => c.trim().toUpperCase())
    : DEFAULT_AVAILABILITY_COUNTRIES;
  const limit = options?.limit ?? 1000;
  const concurrency = options?.concurrency ?? 5;
  const provider = options?.provider ?? new TmdbJustWatchProvider();

  const syncLog = await prisma.syncLog.create({
    data: { jobType: 'sync-availability', status: 'running' },
  });

  let moviesProcessed = 0;
  let offersSaved = 0;
  let failed = 0;

  try {
    const movies = await prisma.movie.findMany({
      orderBy: { popularity: 'desc' },
      take: limit,
      select: { id: true, tmdbId: true, imdbId: true },
    });

    logger.info(
      { movieCount: movies.length, countries, provider: provider.name },
      'Starting availability sync'
    );

    for (let i = 0; i < movies.length; i += concurrency) {
      const batch = movies.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((m) =>
          upsertMovieAvailability(
            m.id,
            { tmdbId: m.tmdbId, imdbId: m.imdbId },
            countries,
            provider
          )
        )
      );

      for (const res of results) {
        if (res.status === 'fulfilled') {
          moviesProcessed++;
          offersSaved += res.value.offersCount;
        } else {
          failed++;
          logger.error({ err: res.reason }, 'Failed to sync movie availability');
        }
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        itemsProcessed: moviesProcessed,
        finishedAt: new Date(),
        errorSummary: failed > 0 ? `${failed} movies failed` : null,
      },
    });

    return { moviesProcessed, offersSaved, failed };
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        itemsProcessed: moviesProcessed,
        finishedAt: new Date(),
        errorSummary: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    throw err;
  }
}
