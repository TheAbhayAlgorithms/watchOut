import { RoleType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getMeiliClient } from '@/lib/meili';

export const MOVIES_INDEX = 'movies';

export interface MovieSearchDocument {
  id: number;
  tmdbId: number;
  title: string;
  originalTitle: string;
  slug: string;
  year: number | null;
  runtime: number | null;
  synopsis: string;
  posterPath: string | null;
  originalLanguage: string;
  languages: string[];
  popularity: number;
  voteAverage: number;
  genreSlugs: string[];
  genres: string[];
  directors: string[];
  castNames: string[];
  availableCountries: string[];
  availabilityKeys: string[];
  platformsByCountry: Record<
    string,
    Array<{ id: number; name: string; slug: string; logoPath: string | null; offerType: string }>
  >;
}

export async function ensureMoviesIndexSettings(): Promise<void> {
  const meili = getMeiliClient();
  const index = meili.index<MovieSearchDocument>(MOVIES_INDEX);

  const task = await index.updateSettings({
    searchableAttributes: ['title', 'originalTitle', 'directors', 'castNames', 'synopsis'],
    filterableAttributes: [
      'year',
      'genreSlugs',
      'originalLanguage',
      'languages',
      'availabilityKeys',
      'availableCountries',
    ],
    sortableAttributes: ['popularity', 'year', 'voteAverage'],
    rankingRules: [
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'popularity:desc',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
  });

  await meili.waitForTask(task.taskUid, { timeOutMs: 15000 });
}

export async function buildMovieSearchDocuments(movieIds?: number[]): Promise<MovieSearchDocument[]> {
  const movies = await prisma.movie.findMany({
    where: movieIds?.length ? { id: { in: movieIds } } : undefined,
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { order: 'asc' } },
      availability: { include: { platform: true } },
    },
  });

  return movies.map((movie) => {
    const directors = movie.cast
      .filter((c) => c.roleType === RoleType.crew && c.job === 'Director')
      .map((c) => c.person.name);

    const castNames = movie.cast
      .filter((c) => c.roleType === RoleType.cast)
      .slice(0, 8)
      .map((c) => c.person.name);

    const availabilityKeysSet = new Set<string>();
    const availableCountriesSet = new Set<string>();
    const platformsByCountry: MovieSearchDocument['platformsByCountry'] = {};

    for (const avail of movie.availability) {
      availableCountriesSet.add(avail.countryCode);
      availabilityKeysSet.add(`${avail.countryCode}:${avail.platformId}`);
      availabilityKeysSet.add(`${avail.countryCode}:${avail.offerType}`);
      availabilityKeysSet.add(`${avail.countryCode}:${avail.platformId}:${avail.offerType}`);

      const list = platformsByCountry[avail.countryCode] ?? [];
      list.push({
        id: avail.platform.id,
        name: avail.platform.name,
        slug: avail.platform.slug,
        logoPath: avail.platform.logoPath,
        offerType: avail.offerType,
      });
      platformsByCountry[avail.countryCode] = list;
    }

    return {
      id: movie.id,
      tmdbId: movie.tmdbId,
      title: movie.title,
      originalTitle: movie.originalTitle,
      slug: movie.slug,
      year: movie.year,
      runtime: movie.runtime,
      synopsis: movie.synopsis,
      posterPath: movie.posterPath,
      originalLanguage: movie.originalLanguage,
      languages: movie.languages,
      popularity: movie.popularity,
      voteAverage: movie.voteAverage,
      genreSlugs: movie.genres.map((mg) => mg.genre.slug),
      genres: movie.genres.map((mg) => mg.genre.name),
      directors,
      castNames,
      availableCountries: Array.from(availableCountriesSet),
      availabilityKeys: Array.from(availabilityKeysSet),
      platformsByCountry,
    };
  });
}

export async function reindexAllMovies(batchSize = 500): Promise<{ indexed: number }> {
  await ensureMoviesIndexSettings();
  const meili = getMeiliClient();
  const index = meili.index<MovieSearchDocument>(MOVIES_INDEX);

  const allIds = await prisma.movie.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let indexed = 0;
  for (let i = 0; i < allIds.length; i += batchSize) {
    const batchIds = allIds.slice(i, i + batchSize).map((m) => m.id);
    const docs = await buildMovieSearchDocuments(batchIds);
    if (docs.length > 0) {
      const task = await index.addDocuments(docs, { primaryKey: 'id' });
      await meili.waitForTask(task.taskUid, { timeOutMs: 30000 });
      indexed += docs.length;
    }
    logger.info({ indexed, total: allIds.length }, 'Meilisearch reindex progress');
  }

  return { indexed };
}
