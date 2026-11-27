import { Queue } from 'bullmq';
import { getRedis } from '@/lib/redis';

export const MOVIE_QUEUE_NAME = 'wtw-movie-ingestion';
export const AVAILABILITY_QUEUE_NAME = 'wtw-availability-sync';
export const SEARCH_INDEX_QUEUE_NAME = 'wtw-search-index';

export interface IngestMovieJobData {
  tmdbId: number;
}

export interface DiscoverPageJobData {
  page: number;
}

export interface SyncAvailabilityJobData {
  movieId: number;
  tmdbId: number;
  imdbId?: string | null;
  countries: string[];
}

export interface IndexMoviesJobData {
  movieIds: number[];
}

const defaultJobOptions = {
  attempts: 4,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

export function createQueues() {
  const connection = getRedis();

  const movieQueue = new Queue(MOVIE_QUEUE_NAME, {
    connection,
    defaultJobOptions,
  });

  const availabilityQueue = new Queue(AVAILABILITY_QUEUE_NAME, {
    connection,
    defaultJobOptions,
  });

  const searchIndexQueue = new Queue(SEARCH_INDEX_QUEUE_NAME, {
    connection,
    defaultJobOptions,
  });

  return { movieQueue, availabilityQueue, searchIndexQueue };
}
