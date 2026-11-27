# WhereToWatch

A fast, dark-mode movie discovery platform where users search for any movie in the world and see which streaming platforms carry it in their country (subscription, free with ads, rent, or buy), along with key movie details.

> **Disclaimer**: WhereToWatch does **not** host, stream, or scrape video content. All availability data is sourced via the TMDB `watch/providers` API (powered by JustWatch) and links out to official provider pages.

---

## Tech Stack

- **Frontend & API**: Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Search**: Meilisearch (typo tolerance, instant results `< 200 ms`, faceted filters)
- **Cache & Queue**: Redis 7 + BullMQ (rate-limited ingestion & daily syncs)

---

## Local Development Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and add your TMDB API credentials:

```bash
cp .env.example .env
```

Required in `.env`:
- `TMDB_API_KEY` or `TMDB_READ_ACCESS_TOKEN` (from [TMDB Developer Settings](https://developer.themoviedb.org/))
- `OMDB_API_KEY` *(optional, for IMDb & Rotten Tomatoes scores)*

### 2. Start Infrastructure (Postgres, Redis, Meilisearch)

```bash
docker compose up -d --wait
```

### 3. Install Dependencies & Run Database Migrations

```bash
npm install
npx prisma migrate deploy
```

### 4. Ingest Movies, Availability & Build Search Index

Run the pilot ingestion (1,000 popular movies), fetch streaming availability for India, US, and UK, and index into Meilisearch:

```bash
npm run cli -- sync-movies --limit=1000
npm run cli -- sync-availability --countries=IN,US,GB --limit=1000
npm run cli -- reindex-search
```

### 5. Start the App (and Optional Background Worker)

```bash
npm run dev
```

In a separate terminal, start the BullMQ worker for background syncs and daily TMDB changes:

```bash
npm run worker
```

Open [http://localhost:3000](http://localhost:3000) and search for any movie (e.g., `Inception`).

---

## CLI Commands

| Command | Description |
| --- | --- |
| `npm run cli -- sync-movies --limit=1000` | Discover & upsert popular TMDB movies idempotently |
| `npm run cli -- sync-availability --countries=IN,US,GB --limit=1000` | Fetch & store regional streaming offers |
| `npm run cli -- reindex-search` | Push all DB movies & regional availability into Meilisearch |
| `npm run cli -- enqueue-bulk --pages=50` | Enqueue TMDB discover pages into BullMQ for background ingestion |

---

## Scripts

- `npm run typecheck` — strict TypeScript check (`tsc --noEmit`)
- `npm run lint` — ESLint check
- `npm test` — Vitest unit & integration tests
- `npm run build` — production Next.js build

---

## Production Deployment (Vercel + Managed Services)

1. **Database**: Provision a managed PostgreSQL instance (e.g., Neon, Supabase, or RDS) and set `DATABASE_URL`. Run `npx prisma migrate deploy`.
2. **Redis**: Provision a managed Redis instance (e.g., Upstash or Redis Cloud) and set `REDIS_URL`.
3. **Meilisearch**: Provision Meilisearch Cloud (or self-host on Fly.io/Railway) and set `MEILI_URL` + `MEILI_MASTER_KEY`.
4. **Web App (Vercel)**:
   - Connect the repository to Vercel.
   - Set all environment variables (`DATABASE_URL`, `REDIS_URL`, `MEILI_URL`, `MEILI_MASTER_KEY`, `TMDB_API_KEY`, `NEXT_PUBLIC_APP_URL`).
5. **Background Worker**:
   - Deploy `npm run worker` as a long-running process on Railway, Fly.io, or Render using the same environment variables so BullMQ repeatable cron jobs (`daily-tmdb-changes`, `popular-availability-refresh`, `longtail-availability-refresh`) run automatically.

---

## Attribution & Legal

- Movie metadata provided by [TMDB](https://www.themoviedb.org/).
- Streaming availability data powered by [JustWatch](https://www.justwatch.com/).
- Review [TMDB's Terms of Use](https://www.themoviedb.org/terms-of-use) before commercializing.
