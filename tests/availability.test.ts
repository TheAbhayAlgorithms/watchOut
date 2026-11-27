import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { normalizeTmdbWatchProviders } from '@/providers/tmdb-availability';
import { AvailabilityProvider } from '@/providers/types';
import { upsertMovieAvailability } from '@/services/availability-sync';
import { normalizeTmdbMovie, upsertNormalizedMovie } from '@/services/movie-ingestion';

describe('Phase 3: Availability Provider & Sync', () => {
  const testTmdbMovieId = 99999902;
  const testProviderIds = [99001, 99002];

  afterAll(async () => {
    await prisma.movie.deleteMany({ where: { tmdbId: testTmdbMovieId } });
    await prisma.platform.deleteMany({ where: { tmdbProviderId: { in: testProviderIds } } });
    await prisma.$disconnect();
  });

  it('normalizes TMDB watch/providers across IN, US, GB and deduplicates free/ads', () => {
    const offers = normalizeTmdbWatchProviders(
      {
        IN: {
          link: 'https://www.themoviedb.org/movie/27205/watch?locale=IN',
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 },
          ],
          free: [
            { provider_id: 100, provider_name: 'YouTube Free', logo_path: '/yt.jpg', display_priority: 5 },
          ],
          ads: [
            { provider_id: 100, provider_name: 'YouTube Free', logo_path: '/yt.jpg', display_priority: 5 },
          ],
          rent: [
            { provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg', display_priority: 2 },
          ],
        },
        US: {
          link: 'https://www.themoviedb.org/movie/27205/watch?locale=US',
          buy: [
            { provider_id: 10, provider_name: 'Amazon Video', logo_path: '/amazon.jpg', display_priority: 3 },
          ],
        },
      },
      ['IN', 'US', 'GB']
    );

    expect(offers).toHaveLength(4);
    expect(offers.filter((o) => o.countryCode === 'IN')).toHaveLength(3);
    expect(offers.filter((o) => o.countryCode === 'US')).toHaveLength(1);
    expect(offers.filter((o) => o.countryCode === 'GB')).toHaveLength(0);
    expect(offers.find((o) => o.providerExternalId === 8)?.offerType).toBe('sub');
    expect(offers.find((o) => o.providerExternalId === 100)?.offerType).toBe('free');
  });

  it('syncs availability idempotently and removes stale offers on re-sync', async () => {
    const movieId = await upsertNormalizedMovie(
      normalizeTmdbMovie({
        id: testTmdbMovieId,
        title: 'Availability Test Movie',
        original_title: 'Availability Test Movie',
        release_date: '2022-01-01',
      })
    );

    const mockProviderV1: AvailabilityProvider = {
      name: 'mock_provider',
      async fetchMovieAvailability() {
        return {
          source: 'mock_provider',
          checkedAt: new Date('2026-01-01T00:00:00Z'),
          offers: [
            {
              providerExternalId: 99001,
              providerName: 'TestFlix',
              providerLogoPath: '/tf.png',
              displayPriority: 1,
              countryCode: 'IN',
              offerType: 'sub',
              price: null,
              currency: null,
              deepLink: 'https://example.com/in',
            },
            {
              providerExternalId: 99002,
              providerName: 'TestRent',
              providerLogoPath: '/tr.png',
              displayPriority: 2,
              countryCode: 'US',
              offerType: 'rent',
              price: 3.99,
              currency: 'USD',
              deepLink: 'https://example.com/us',
            },
          ],
        };
      },
    };

    await upsertMovieAvailability(movieId, { tmdbId: testTmdbMovieId }, ['IN', 'US', 'GB'], mockProviderV1);

    const rowsV1 = await prisma.availability.findMany({ where: { movieId } });
    expect(rowsV1).toHaveLength(2);

    // Re-sync where US offer is removed
    const mockProviderV2: AvailabilityProvider = {
      name: 'mock_provider',
      async fetchMovieAvailability() {
        return {
          source: 'mock_provider',
          checkedAt: new Date('2026-01-02T00:00:00Z'),
          offers: [
            {
              providerExternalId: 99001,
              providerName: 'TestFlix',
              providerLogoPath: '/tf.png',
              displayPriority: 1,
              countryCode: 'IN',
              offerType: 'sub',
              price: null,
              currency: null,
              deepLink: 'https://example.com/in',
            },
          ],
        };
      },
    };

    await upsertMovieAvailability(movieId, { tmdbId: testTmdbMovieId }, ['IN', 'US', 'GB'], mockProviderV2);

    const rowsV2 = await prisma.availability.findMany({ where: { movieId } });
    expect(rowsV2).toHaveLength(1);
    expect(rowsV2[0]?.countryCode).toBe('IN');
  });
});
