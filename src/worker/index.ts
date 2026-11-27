import 'dotenv/config';
import { Job, Worker } from 'bullmq';
import { prisma } from '@/lib/db';
import { invalidateMovieCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { getMeiliClient } from '@/lib/meili';
import { getRedis } from '@/lib/redis';
import { TmdbClient } from '@/providers/tmdb-client';
import {
  DEFAULT_AVAILABILITY_COUNTRIES,
  upsertMovieAvailability,
} from '@/services/availability-sync';
import { ingestMovieByTmdbId } from '@/services/movie-ingestion';
import {
  buildMovieSearchDocuments,
  ensureMoviesIndexSettings,
  MOVIES_INDEX,
  MovieSearchDocument,
} from '@/services/search-indexer';
import {
  AVAILABILITY_QUEUE_NAME,
  createQueues,
  DiscoverPageJobData,
  IndexMoviesJobData,
  IngestMovieJobData,
  MOVIE_QUEUE_NAME,
  SEARCH_INDEX_QUEUE_NAME,
  SyncAvailabilityJobData,
} from '@/worker/queues';

async function registerRepeatableJobs() {
  const { movieQueue, availabilityQueue } = createQueues();

  // Daily incremental TMDB changes sync at 02:00 UTC
  await movieQueue.upsertJobScheduler(
    'daily-tmdb-changes',
    { pattern: '0 2 * * *' },
    { name: 'sync-tmdb-changes', data: {} }
  );

  // Refresh popular movies availability every 6 hours
  await availabilityQueue.upsertJobScheduler(
    'popular-availability-refresh',
    { pattern: '0 */6 * * *' },
    { name: 'enqueue-popular-availability', data: { limit: 500 } }
  );

  // Refresh long-tail availability daily at 04:00 UTC
  await availabilityQueue.upsertJobScheduler(
    'longtail-availability-refresh',
    { pattern: '0 4 * * *' },
    { name: 'enqueue-longtail-availability', data: { limit: 2000 } }
  );

  await Promise.all([movieQueue.close(), availabilityQueue.close()]);
  logger.info('Registered BullMQ repeatable sync schedules');
}

export async function startWorker() {
  const connection = getRedis();
  const tmdbClient = new TmdbClient();
  const { movieQueue, availabilityQueue, searchIndexQueue } = createQueues();

  await ensureMoviesIndexSettings();
  await registerRepeatableJobs();

  const movieWorker = new Worker(
    MOVIE_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'ingest-movie') {
        const { tmdbId } = job.data as IngestMovieJobData;
        const movieId = await ingestMovieByTmdbId(tmdbId, tmdbClient);
        await invalidateMovieCache(movieId);
        await searchIndexQueue.add('index-movies', { movieIds: [movieId] });
        return { movieId };
      }

      if (job.name === 'discover-page') {
        const { page } = job.data as DiscoverPageJobData;
        const res = await tmdbClient.discoverMovies(page, 'popularity.desc');
        await movieQueue.addBulk(
          res.results.map((m) => ({
            name: 'ingest-movie',
            data: { tmdbId: m.id },
            opts: { jobId: `ingest-${m.id}` },
          }))
        );
        return { enqueued: res.results.length };
      }

      if (job.name === 'sync-tmdb-changes') {
        const today = new Date();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const startDate = yesterday.toISOString().slice(0, 10);
        const endDate = today.toISOString().slice(0, 10);

        const changes = await tmdbClient.getMovieChanges(startDate, endDate, 1);
        const ids = changes.results.filter((r) => !r.adult).map((r) => r.id);

        if (ids.length > 0) {
          const existing = await prisma.movie.findMany({
            where: { tmdbId: { in: ids } },
            select: { tmdbId: true },
          });
          await movieQueue.addBulk(
            existing.map((m) => ({
              name: 'ingest-movie',
              data: { tmdbId: m.tmdbId },
            }))
          );
          logger.info({ changedCount: existing.length }, 'Enqueued changed TMDB movies');
        }
        return { checked: ids.length };
      }

      return null;
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 25, duration: 1000 },
    }
  );

  const availabilityWorker = new Worker(
    AVAILABILITY_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'sync-movie-availability') {
        const data = job.data as SyncAvailabilityJobData;
        const res = await upsertMovieAvailability(
          data.movieId,
          { tmdbId: data.tmdbId, imdbId: data.imdbId },
          data.countries
        );
        await invalidateMovieCache(data.movieId);
        await searchIndexQueue.add('index-movies', { movieIds: [data.movieId] });
        return res;
      }

      if (job.name === 'enqueue-popular-availability') {
        const limit = (job.data as { limit?: number }).limit ?? 500;
        const movies = await prisma.movie.findMany({
          orderBy: { popularity: 'desc' },
          take: limit,
          select: { id: true, tmdbId: true, imdbId: true },
        });
        await availabilityQueue.addBulk(
          movies.map((m) => ({
            name: 'sync-movie-availability',
            data: {
              movieId: m.id,
              tmdbId: m.tmdbId,
              imdbId: m.imdbId,
              countries: DEFAULT_AVAILABILITY_COUNTRIES,
            },
          }))
        );
        return { enqueued: movies.length };
      }

      if (job.name === 'enqueue-longtail-availability') {
        const limit = (job.data as { limit?: number }).limit ?? 2000;
        const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const movies = await prisma.movie.findMany({
          where: {
            OR: [
              { availability: { none: {} } },
              { availability: { some: { lastCheckedAt: { lt: staleCutoff } } } },
            ],
          },
          orderBy: { popularity: 'desc' },
          take: limit,
          select: { id: true, tmdbId: true, imdbId: true },
        });
        await availabilityQueue.addBulk(
          movies.map((m) => ({
            name: 'sync-movie-availability',
            data: {
              movieId: m.id,
              tmdbId: m.tmdbId,
              imdbId: m.imdbId,
              countries: DEFAULT_AVAILABILITY_COUNTRIES,
            },
          }))
        );
        return { enqueued: movies.length };
      }

      return null;
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 25, duration: 1000 },
    }
  );

  const searchIndexWorker = new Worker(
    SEARCH_INDEX_QUEUE_NAME,
    async (job: Job) => {
      const { movieIds } = job.data as IndexMoviesJobData;
      if (!movieIds?.length) return { indexed: 0 };
      const docs = await buildMovieSearchDocuments(movieIds);
      if (docs.length > 0) {
        const meili = getMeiliClient();
        const task = await meili.index<MovieSearchDocument>(MOVIES_INDEX).addDocuments(docs, {
          primaryKey: 'id',
        });
        await meili.waitForTask(task.taskUid, { timeOutMs: 10000 });
      }
      return { indexed: docs.length };
    },
    { connection, concurrency: 2 }
  );

  const shutdown = async () => {
    logger.info('Shutting down BullMQ workers...');
    await Promise.all([
      movieWorker.close(),
      availabilityWorker.close(),
      searchIndexWorker.close(),
      movieQueue.close(),
      availabilityQueue.close(),
      searchIndexQueue.close(),
    ]);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  logger.info('WhereToWatch BullMQ workers started and listening');
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error({ err }, 'Worker startup failed');
    process.exit(1);
  });
}
