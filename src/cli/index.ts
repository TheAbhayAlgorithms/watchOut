import 'dotenv/config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { TmdbConfigError } from '@/providers/tmdb-client';
import {
  DEFAULT_AVAILABILITY_COUNTRIES,
  getDefaultAvailabilityProvider,
  syncAvailabilityForCatalog,
} from '@/services/availability-sync';
import { seedDemoCatalog } from '@/services/demo-seed';
import { syncMoviesCatalog } from '@/services/movie-ingestion';
import { reindexAllMovies } from '@/services/search-indexer';
import { createQueues } from '@/worker/queues';

function parseFlagValue(args: string[], prefix: string): string | undefined {
  const exact = args.find((a) => a.startsWith(`${prefix}=`));
  if (exact) return exact.slice(prefix.length + 1);
  const idx = args.indexOf(prefix);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

async function main() {
  const [, , command, ...args] = process.argv;

  try {
    switch (command) {
      case 'sync-movies': {
        const limitRaw = parseFlagValue(args, '--limit');
        const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 1000;
        const result = await syncMoviesCatalog({
          limit: Number.isFinite(limit) && limit > 0 ? limit : 1000,
        });
        logger.info(result, 'sync-movies completed');
        break;
      }
      case 'sync-availability': {
        const countriesRaw = parseFlagValue(args, '--countries');
        const countries = countriesRaw
          ? countriesRaw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
          : DEFAULT_AVAILABILITY_COUNTRIES;
        const limitRaw = parseFlagValue(args, '--limit');
        const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 1000;
        const providerFlag = parseFlagValue(args, '--provider');
        const result = await syncAvailabilityForCatalog({
          countries,
          limit: Number.isFinite(limit) && limit > 0 ? limit : 1000,
          provider: getDefaultAvailabilityProvider(providerFlag),
        });
        logger.info(result, 'sync-availability completed');
        break;
      }
      case 'reindex-search': {
        const result = await reindexAllMovies();
        logger.info(result, 'reindex-search completed');
        break;
      }
      case 'seed-demo': {
        const result = await seedDemoCatalog();
        logger.info(result, 'seed-demo completed');
        break;
      }
      case 'enqueue-bulk': {
        const pagesRaw = parseFlagValue(args, '--pages');
        const pages = pagesRaw ? Number.parseInt(pagesRaw, 10) : 50;
        const { movieQueue } = createQueues();
        await movieQueue.addBulk(
          Array.from({ length: Math.min(500, Math.max(1, pages)) }, (_, idx) => ({
            name: 'discover-page',
            data: { page: idx + 1 },
          }))
        );
        await movieQueue.close();
        logger.info({ pages }, 'Enqueued bulk TMDB discover pages into BullMQ');
        break;
      }
      default: {
        console.log(
          [
            'WhereToWatch CLI',
            'Usage:',
            '  npm run cli -- sync-movies [--limit=1000]',
            '  npm run cli -- sync-availability [--countries=IN,US,GB]',
            '  npm run cli -- reindex-search',
          ].join('\n')
        );
        process.exitCode = command ? 1 : 0;
      }
    }
  } catch (err) {
    if (err instanceof TmdbConfigError) {
      logger.error(err.message);
    } else {
      logger.error({ err }, 'CLI command failed');
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
