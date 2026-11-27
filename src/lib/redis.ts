import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6380';
    globalForRedis.redis = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return globalForRedis.redis;
}
