import { RoleType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { slugify } from '@/lib/slug';
import { TmdbClient, TmdbMovieDetail } from '@/providers/tmdb-client';
import { fetchOmdbRatings } from '@/providers/omdb-client';

export interface NormalizedMovieData {
  tmdbId: number;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  slug: string;
  year: number | null;
  releaseDate: Date | null;
  runtime: number | null;
  synopsis: string;
  posterPath: string | null;
  backdropPath: string | null;
  originalLanguage: string;
  languages: string[];
  countries: string[];
  popularity: number;
  voteAverage: number;
  voteCount: number;
  trailerUrl: string | null;
  similarTmdbIds: number[];
  genres: Array<{ tmdbId: number; name: string; slug: string }>;
  cast: Array<{
    tmdbId: number;
    name: string;
    profilePath: string | null;
    roleType: RoleType;
    character: string | null;
    job: string | null;
    order: number;
  }>;
}

export function extractYouTubeTrailerUrl(detail: TmdbMovieDetail): string | null {
  const videos = detail.videos?.results ?? [];
  const youtubeVideos = videos.filter((v) => v.site.toLowerCase() === 'youtube' && v.key);
  if (youtubeVideos.length === 0) return null;

  const preferred =
    youtubeVideos.find((v) => v.type === 'Trailer' && v.official) ??
    youtubeVideos.find((v) => v.type === 'Trailer') ??
    youtubeVideos.find((v) => v.type === 'Teaser') ??
    youtubeVideos[0];

  return preferred ? `https://www.youtube.com/watch?v=${preferred.key}` : null;
}

export function normalizeTmdbMovie(detail: TmdbMovieDetail): NormalizedMovieData {
  const releaseDateStr = detail.release_date?.trim();
  const parsedDate =
    releaseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(releaseDateStr)
      ? new Date(`${releaseDateStr}T00:00:00.000Z`)
      : null;
  const year =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getUTCFullYear()
      : releaseDateStr && /^\d{4}/.test(releaseDateStr)
        ? Number.parseInt(releaseDateStr.slice(0, 4), 10)
        : null;

  const title = detail.title?.trim() || detail.original_title?.trim() || `Movie ${detail.id}`;
  const originalTitle = detail.original_title?.trim() || title;

  const languages = Array.from(
    new Set(
      (detail.spoken_languages ?? [])
        .map((l) => l.iso_639_1?.trim().toLowerCase())
        .filter((l): l is string => Boolean(l))
    )
  );
  const originalLanguage = detail.original_language?.trim().toLowerCase() || 'en';
  if (!languages.includes(originalLanguage)) {
    languages.unshift(originalLanguage);
  }

  const countries = Array.from(
    new Set(
      (detail.production_countries ?? [])
        .map((c) => c.iso_3166_1?.trim().toUpperCase())
        .filter((c): c is string => Boolean(c))
    )
  );

  const genres = (detail.genres ?? []).map((g) => ({
    tmdbId: g.id,
    name: g.name,
    slug: slugify(g.name),
  }));

  const topCast = (detail.credits?.cast ?? []).slice(0, 12).map((c, idx) => ({
    tmdbId: c.id,
    name: c.name,
    profilePath: c.profile_path ?? null,
    roleType: RoleType.cast,
    character: c.character?.trim() || null,
    job: null,
    order: c.order ?? idx,
  }));

  const directors = (detail.credits?.crew ?? [])
    .filter((c) => c.job === 'Director')
    .slice(0, 3)
    .map((d, idx) => ({
      tmdbId: d.id,
      name: d.name,
      profilePath: d.profile_path ?? null,
      roleType: RoleType.crew,
      character: null,
      job: 'Director',
      order: idx,
    }));

  const similarTmdbIds = (detail.similar?.results ?? []).slice(0, 12).map((s) => s.id);

  return {
    tmdbId: detail.id,
    imdbId: detail.imdb_id ?? detail.external_ids?.imdb_id ?? null,
    title,
    originalTitle,
    slug: slugify(title),
    year,
    releaseDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
    runtime: detail.runtime ?? null,
    synopsis: detail.overview?.trim() ?? '',
    posterPath: detail.poster_path ?? null,
    backdropPath: detail.backdrop_path ?? null,
    originalLanguage,
    languages,
    countries,
    popularity: detail.popularity ?? 0,
    voteAverage: detail.vote_average ?? 0,
    voteCount: detail.vote_count ?? 0,
    trailerUrl: extractYouTubeTrailerUrl(detail),
    similarTmdbIds,
    genres,
    cast: [...directors, ...topCast],
  };
}

export async function upsertNormalizedMovie(
  data: NormalizedMovieData,
  options?: { enrichOmdb?: boolean }
): Promise<number> {
  const omdb =
    options?.enrichOmdb && data.imdbId ? await fetchOmdbRatings(data.imdbId) : null;

  const movie = await prisma.movie.upsert({
    where: { tmdbId: data.tmdbId },
    update: {
      imdbId: data.imdbId,
      title: data.title,
      originalTitle: data.originalTitle,
      slug: data.slug,
      year: data.year,
      releaseDate: data.releaseDate,
      runtime: data.runtime,
      synopsis: data.synopsis,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
      originalLanguage: data.originalLanguage,
      languages: data.languages,
      countries: data.countries,
      popularity: data.popularity,
      voteAverage: data.voteAverage,
      voteCount: data.voteCount,
      trailerUrl: data.trailerUrl,
      similarTmdbIds: data.similarTmdbIds,
      ...(omdb
        ? {
            imdbRating: omdb.imdbRating,
            rottenTomatoesScore: omdb.rottenTomatoesScore,
          }
        : {}),
    },
    create: {
      tmdbId: data.tmdbId,
      imdbId: data.imdbId,
      title: data.title,
      originalTitle: data.originalTitle,
      slug: data.slug,
      year: data.year,
      releaseDate: data.releaseDate,
      runtime: data.runtime,
      synopsis: data.synopsis,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
      originalLanguage: data.originalLanguage,
      languages: data.languages,
      countries: data.countries,
      popularity: data.popularity,
      voteAverage: data.voteAverage,
      voteCount: data.voteCount,
      trailerUrl: data.trailerUrl,
      similarTmdbIds: data.similarTmdbIds,
      imdbRating: omdb?.imdbRating ?? null,
      rottenTomatoesScore: omdb?.rottenTomatoesScore ?? null,
    },
    select: { id: true },
  });

  // Sync genres idempotently
  if (data.genres.length > 0) {
    const genreIds: number[] = [];
    for (const g of data.genres) {
      const upsertedGenre = await prisma.genre.upsert({
        where: { tmdbId: g.tmdbId },
        update: { name: g.name, slug: g.slug },
        create: { tmdbId: g.tmdbId, name: g.name, slug: g.slug },
        select: { id: true },
      });
      genreIds.push(upsertedGenre.id);
    }

    await prisma.movieGenre.deleteMany({ where: { movieId: movie.id } });
    await prisma.movieGenre.createMany({
      data: genreIds.map((genreId) => ({ movieId: movie.id, genreId })),
      skipDuplicates: true,
    });
  }

  // Sync cast & crew idempotently
  await prisma.movieCast.deleteMany({ where: { movieId: movie.id } });
  if (data.cast.length > 0) {
    const castRows: Array<{
      movieId: number;
      personId: number;
      roleType: RoleType;
      character: string | null;
      job: string | null;
      order: number;
    }> = [];

    for (const member of data.cast) {
      const person = await prisma.person.upsert({
        where: { tmdbId: member.tmdbId },
        update: { name: member.name, profilePath: member.profilePath },
        create: { tmdbId: member.tmdbId, name: member.name, profilePath: member.profilePath },
        select: { id: true },
      });
      castRows.push({
        movieId: movie.id,
        personId: person.id,
        roleType: member.roleType,
        character: member.character,
        job: member.job,
        order: member.order,
      });
    }

    await prisma.movieCast.createMany({ data: castRows });
  }

  return movie.id;
}

export async function ingestMovieByTmdbId(
  tmdbId: number,
  client = new TmdbClient()
): Promise<number> {
  const detail = await client.getMovieDetails(tmdbId);
  const normalized = normalizeTmdbMovie(detail);
  return upsertNormalizedMovie(normalized, { enrichOmdb: Boolean(process.env.OMDB_API_KEY) });
}

export async function syncMoviesCatalog(options?: {
  limit?: number;
  concurrency?: number;
  client?: TmdbClient;
}): Promise<{ processed: number; failed: number }> {
  const limit = options?.limit ?? 1000;
  const concurrency = options?.concurrency ?? 5;
  const client = options?.client ?? new TmdbClient();

  const syncLog = await prisma.syncLog.create({
    data: { jobType: 'sync-movies', status: 'running' },
  });

  let processed = 0;
  let failed = 0;

  try {
    const tmdbIds: number[] = [];
    const totalPagesNeeded = Math.ceil(limit / 20);

    for (let page = 1; page <= totalPagesNeeded && tmdbIds.length < limit; page++) {
      const res = await client.discoverMovies(page, 'popularity.desc');
      for (const item of res.results) {
        if (tmdbIds.length < limit) {
          tmdbIds.push(item.id);
        }
      }
      if (page >= res.total_pages) break;
    }

    logger.info({ targetCount: tmdbIds.length, concurrency }, 'Starting TMDB movie ingestion');

    for (let i = 0; i < tmdbIds.length; i += concurrency) {
      const batch = tmdbIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((tmdbId) => ingestMovieByTmdbId(tmdbId, client))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          failed++;
          logger.error({ err: result.reason }, 'Failed to ingest movie');
        }
      }

      if ((i + batch.length) % 100 === 0 || i + batch.length === tmdbIds.length) {
        logger.info({ processed, failed, total: tmdbIds.length }, 'Movie ingestion progress');
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        itemsProcessed: processed,
        finishedAt: new Date(),
        errorSummary: failed > 0 ? `${failed} movies failed` : null,
      },
    });

    return { processed, failed };
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        itemsProcessed: processed,
        finishedAt: new Date(),
        errorSummary: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    throw err;
  }
}
