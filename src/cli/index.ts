import 'dotenv/config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { TmdbConfigError } from '@/providers/tmdb-client';
import {
  DEFAULT_AVAILABILITY_COUNTRIES,
  syncAvailabilityForCatalog,
} from '@/services/availability-sync';
import { syncMoviesCatalog } from '@/services/movie-ingestion';

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
        const result = await syncAvailabilityForCatalog({
          countries,
          limit: Number.isFinite(limit) && limit > 0 ? limit : 1000,
        });
        logger.info(result, 'sync-availability completed');
        break;
      }
      case 'reindex-search': {
        logger.info('reindex-search will be implemented in Phase 4');
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
