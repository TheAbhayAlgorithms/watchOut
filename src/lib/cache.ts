import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedis();

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.warn({ key, err }, 'Redis cache read failed; falling back to DB');
  }

  const fresh = await fetcher();

  if (fresh !== null && fresh !== undefined) {
    try {
      await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ key, err }, 'Redis cache write failed');
    }
  }

  return fresh;
}

export async function invalidateMovieCache(movieId: number): Promise<void> {
  const redis = getRedis();
  try {
    const keys = await redis.keys(`wtw:movie:${movieId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.warn({ movieId, err }, 'Failed to invalidate movie cache');
  }
}
