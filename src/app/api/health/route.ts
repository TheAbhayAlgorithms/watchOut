import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getRedis } from '@/lib/redis';
import { getMeiliClient } from '@/lib/meili';

export const dynamic = 'force-dynamic';

const globalForPool = globalThis as unknown as { pgPool?: Pool };

function getPgPool(): Pool {
  if (!globalForPool.pgPool) {
    globalForPool.pgPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://wheretowatch:wheretowatch_dev@localhost:5433/wheretowatch?schema=public',
    });
  }
  return globalForPool.pgPool;
}

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {
    postgres: { ok: false },
    redis: { ok: false },
    meilisearch: { ok: false },
  };

  await Promise.all([
    (async () => {
      try {
        await getPgPool().query('SELECT 1');
        checks.postgres = { ok: true };
      } catch (err) {
        checks.postgres = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })(),
    (async () => {
      try {
        const redis = getRedis();
        const pong = await redis.ping();
        checks.redis = { ok: pong === 'PONG' };
      } catch (err) {
        checks.redis = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })(),
    (async () => {
      try {
        const health = await getMeiliClient().health();
        checks.meilisearch = { ok: health.status === 'available' };
      } catch (err) {
        checks.meilisearch = {
          ok: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    })(),
  ]);

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', services: checks },
    { status: allOk ? 200 : 503 }
  );
}
