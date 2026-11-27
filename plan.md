# WhereToWatch — Architecture & Implementation Plan

> A movie discovery platform (not a streaming service) where users search for any movie in the world and instantly see which platforms carry it in their country, how it is available (subscription, free with ads, rent, buy), and key movie details.

---

## 1. Assumptions & Key Decisions

1. **Runtime & Package Manager**: Node.js (`v26` detected) with `npm` workspaces or a unified `package.json` using `tsx` for worker/CLI scripts.
2. **Backend Architecture**: Next.js App Router (Route Handlers + Server Components) for web & API, paired with a standalone Node.js worker process (`src/worker`) running BullMQ queues so long-running ingestion never blocks HTTP requests.
3. **Search Engine**: **Meilisearch** (lightweight, single binary/container, built-in typo tolerance, faceted filtering, sub-50ms query times, simple JS SDK).
4. **Database & ORM**: **PostgreSQL 16** with **Prisma ORM** for type-safe queries, migrations, and clean relational modeling.
5. **Caching & Queues**: **Redis 7** for both BullMQ job queues and API/SSR response caching.
6. **Country Detection**: Default to **India (`IN`)**. On first visit, detect country via IP headers (`x-vercel-ip-country` / `cf-ipcountry` / `x-forwarded-for` lookup fallback) and persist user overrides in a cookie (`wtw_country`) so Server Components can render country-specific availability with zero layout shift.
7. **API Keys**: Requires `TMDB_API_KEY` (or `TMDB_READ_ACCESS_TOKEN`) in `.env`. `OMDB_API_KEY` is optional; if omitted, the app gracefully falls back to TMDB `vote_average` without failing.
8. **Legal & Attribution**: No video hosting or scraping. All outbound links point to official JustWatch/TMDB provider links. Persistent footer displays the required TMDB and JustWatch attributions.

---

## 2. System Architecture

```
                         ┌──────────────────────────────────┐
                         │         User / Browser           │
                         └────────────────┬─────────────────┘
                                          │ HTTPS
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Next.js 15+ (App Router + TypeScript)                │
│  ┌───────────────────────────┐    ┌──────────────────────────────────┐  │
│  │  SSR Pages & Metadata     │    │  API Route Handlers              │  │
│  │  - / (Hero Search)        │    │  - GET /api/search               │  │
│  │  - /movie/[idSlug]        │    │  - GET /api/movies/[id]          │  │
│  │  - /platform/[idSlug]     │    │  - GET /api/platforms            │  │
│  │  - /sitemap.xml           │    │  - POST /api/country             │  │
│  └─────────────┬─────────────┘    └────────────────┬─────────────────┘  │
└────────────────┼───────────────────────────────────┼────────────────────┘
                 │                                   │
       ┌─────────┴──────────┬────────────────────────┼──────────┐
       ▼                    ▼                        ▼          │
┌──────────────┐   ┌────────────────┐      ┌───────────────┐    │
│ Meilisearch  │   │  PostgreSQL    │      │    Redis      │    │
│ (movies idx) │   │  (Prisma ORM)  │      │ (Cache +      │    │
│ <50ms search │   │  Master DB     │      │  BullMQ)      │    │
└──────▲───────┘   └────────▲───────┘      └───────▲───────┘    │
       │                    │                      │            │
       └────────────────────┼──────────────────────┘            │
                            │                                   │
                  ┌─────────┴──────────┐                        │
                  │  Ingestion Worker  │◄───────────────────────┘
                  │  (BullMQ + Node)   │
                  └─────────┬──────────┘
                            │ Rate-limited HTTP + Retries
                            ▼
          ┌───────────────────────────────────┐
          │       External Data Sources       │
          │  - TMDB API (Metadata + Providers)│
          │  - OMDb API (Optional Ratings)    │
          │  - Future: Watchmode / Streaming  │
          └───────────────────────────────────┘
```

### Performance Targets
- **Search API (`/api/search`)**: `< 200 ms` (Meilisearch in-memory prefix/typo index + optional Redis cache for hot queries).
- **Movie Page (`/movie/{id}-{slug}`)**: `< 1 s` TTFB via Next.js Server Components + Redis-cached movie/availability payload (short TTL per country, e.g., 15–30 min, invalidated on sync).

---

## 3. Data Sources & Provider Abstraction

### 3.1 Metadata Source
- **TMDB API v3**:
  - Bulk discovery via `/discover/movie` (sorted by popularity/vote_count) and `/movie/{id}` with `append_to_response=credits,videos,external_ids,similar`.
  - Incremental updates via `/movie/changes` (daily sync job).
  - Poster & backdrop URLs via `https://image.tmdb.org/t/p/{size}{path}`.

### 3.2 Availability Provider Abstraction
To support adding **Watchmode** or **Streaming Availability API** later without touching UI or core business logic, all availability fetching goes through a strict TypeScript interface:

```ts
export type OfferType = 'sub' | 'free' | 'rent' | 'buy';

export interface NormalizedOffer {
  providerExternalId: string;
  providerName: string;
  providerLogoPath: string | null;
  countryCode: string; // ISO 3166-1 alpha-2 (e.g., IN, US, GB)
  offerType: OfferType;
  price: number | null;
  currency: string | null;
  deepLink: string | null;
}

export interface AvailabilityProvider {
  readonly name: string; // e.g., 'tmdb_justwatch', 'watchmode'
  fetchMovieAvailability(
    identifiers: { tmdbId: number; imdbId?: string | null },
    countries: string[]
  ): Promise<{
    offers: NormalizedOffer[];
    checkedAt: Date;
  }>;
}
```

- **Initial implementation**: `TmdbJustWatchProvider` calling `/movie/{tmdb_id}/watch/providers`.
- **Rate Limiting & Resilience**:
  - BullMQ rate-limited queues (e.g., max 35 requests/sec for TMDB, well within limits).
  - Exponential backoff with jitter on HTTP `429` / `5xx`.
  - Redis response caching for raw API calls during batch runs.
  - Every `availability` row stores `last_checked_at` and `source` so the UI always shows freshness and displays *"No streaming info available for your region"* rather than guessing.

### 3.3 Optional Ratings
- **OMDb API**: Enriches `imdb_rating` and `rotten_tomatoes_score` using `imdb_id` when `OMDB_API_KEY` is configured.

---

## 4. Data Model (PostgreSQL + Prisma)

### Relational Tables
1. **`movies`**
   - `id` (PK, serial or cuid)
   - `tmdb_id` (unique, int)
   - `imdb_id` (nullable, string, indexed)
   - `title` (string), `original_title` (string), `slug` (string)
   - `year` (nullable, int, indexed), `release_date` (nullable, DateTime)
   - `runtime` (nullable, int, minutes)
   - `synopsis` (text)
   - `poster_path` (nullable, string), `backdrop_path` (nullable, string)
   - `original_language` (string, ISO 639-1)
   - `languages` (string[] — spoken languages)
   - `countries` (string[] — production countries)
   - `popularity` (float, indexed for refresh prioritization)
   - `vote_average` (float), `vote_count` (int)
   - `imdb_rating` (nullable, float), `rotten_tomatoes_score` (nullable, int)
   - `trailer_url` (nullable, string — YouTube embed/watch URL)
   - `similar_tmdb_ids` (int[] — for "Not available anywhere" recommendations)
   - `created_at`, `updated_at`

2. **`genres`** & **`movie_genres`**
   - `genres`: `id` (PK), `tmdb_id` (unique, int), `name` (string), `slug` (unique, string)
   - `movie_genres`: `movie_id` + `genre_id` (composite PK)

3. **`people`** & **`movie_cast`**
   - `people`: `id` (PK), `tmdb_id` (unique, int), `name` (string), `profile_path` (nullable, string)
   - `movie_cast`: `id` (PK), `movie_id`, `person_id`, `role_type` (`cast` | `crew`), `character` (nullable, string), `job` (nullable, string, e.g., `Director`), `order` (int)

4. **`platforms`**
   - `id` (PK), `tmdb_provider_id` (unique, int), `name` (string), `slug` (unique, string), `logo_path` (nullable, string), `type` (enum/string: `subscription` | `free` | `transactional` | `mixed`), `display_priority` (int)

5. **`availability`**
   - `id` (PK)
   - `movie_id` (FK -> `movies.id`, cascade delete)
   - `platform_id` (FK -> `platforms.id`, cascade delete)
   - `country_code` (char(2), uppercase e.g. `IN`, `US`, `GB`)
   - `offer_type` (`sub` | `free` | `rent` | `buy`)
   - `price` (nullable, Decimal), `currency` (nullable, string)
   - `deep_link` (nullable, string)
   - `source` (string, default `'tmdb_justwatch'`)
   - `last_checked_at` (DateTime)
   - **Unique constraint**: `(movie_id, platform_id, country_code, offer_type)`
   - **Indexes**:
     - `(country_code, platform_id)` — fast platform catalog browsing
     - `(movie_id, country_code)` — fast movie page availability lookup
     - `(last_checked_at)` — finding stale records to refresh

6. **`sync_logs`** (for idempotency & observability)
   - `id`, `job_type`, `status`, `items_processed`, `started_at`, `finished_at`, `error_summary`

### Meilisearch Index (`movies`)
- **Searchable attributes**: `title`, `original_title`, `directors`, `cast_names`, `synopsis`
- **Filterable attributes**: `year`, `genre_slugs`, `original_language`, `languages`, `availability_keys` (e.g. `IN:8:sub`, `IN:8`, `US:119:rent` for instant platform + country + offer-type filtering), `available_countries`
- **Sortable attributes**: `popularity`, `year`, `vote_average`

---

## 5. Folder Structure

```text
watchOut/
├── docker-compose.yml            # Postgres, Redis, Meilisearch (+ optional app/worker)
├── .env.example                  # TMDB_API_KEY, OMDB_API_KEY, DATABASE_URL, REDIS_URL, MEILI_URL
├── package.json                  # Scripts: dev, build, lint, test, worker, cli
├── tsconfig.json                 # Strict TypeScript config
├── next.config.ts                # Image domains (image.tmdb.org), standalone output
├── prisma/
│   ├── schema.prisma             # Relational schema & indexes
│   └── migrations/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Dark mode default, Header (Country selector), Footer (TMDB + JustWatch attribution)
│   │   ├── page.tsx              # Home: Hero search bar, filters, trending/platform quick links
│   │   ├── movie/[idSlug]/
│   │   │   └── page.tsx          # SSR Movie details, Where to Watch, trailer, similar movies
│   │   ├── platform/[idSlug]/
│   │   │   └── page.tsx          # Browse all movies on a platform in selected country
│   │   ├── sitemap.ts            # Dynamic XML sitemap
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── search/route.ts
│   │       ├── movies/[id]/route.ts
│   │       ├── platforms/route.ts
│   │       └── country/route.ts
│   ├── components/               # Accessible UI components (SearchHero, MovieCard, AvailabilitySection, CountrySelector, Skeletons, etc.)
│   ├── lib/
│   │   ├── db.ts                 # Prisma singleton
│   │   ├── redis.ts              # Redis client + cache helpers
│   │   ├── meili.ts              # Meilisearch client + index setup
│   │   ├── logger.ts             # Structured JSON logger (pino)
│   │   ├── country.ts            # Supported countries, IP detection, cookie helpers
│   │   └── slug.ts               # URL slug utilities
│   ├── providers/
│   │   ├── types.ts              # AvailabilityProvider interface & NormalizedOffer
│   │   ├── tmdb-client.ts        # Rate-limited TMDB HTTP client with retries/backoff
│   │   ├── tmdb-availability.ts  # TmdbJustWatchProvider implementation
│   │   └── omdb-client.ts        # Optional OMDb enrichment client
│   ├── services/
│   │   ├── movie-ingestion.ts    # Idempotent upsert of movies, genres, cast/crew
│   │   ├── availability-sync.ts  # Idempotent upsert of availability + Meilisearch sync
│   │   ├── search-indexer.ts     # Transform DB movies -> Meilisearch documents
│   │   └── query-service.ts      # Cached movie, platform, and search queries
│   ├── worker/
│   │   ├── queues.ts             # BullMQ queue definitions & rate limiters
│   │   ├── processor.ts          # Worker handlers (ingest-movie, sync-availability, daily-changes)
│   │   └── scheduler.ts          # Repeatable cron jobs (daily TMDB changes, popular refresh)
│   └── cli/
│       └── index.ts              # CLI: sync-movies, sync-availability, reindex-search
└── tests/
    ├── ingestion.test.ts         # Unit tests for normalization & idempotency
    ├── availability.test.ts      # Unit tests for provider abstraction & grouping
    └── search.test.ts            # Unit tests for search filter building & ranking
```

---

## 6. Milestones & Phases

### Phase 1: Plan + Project Scaffold + Docker Compose
- Create `plan.md`, `docker-compose.yml` (PostgreSQL 16, Redis 7, Meilisearch), `.env.example`, `.gitignore`.
- Initialize Next.js (App Router, TypeScript, Tailwind CSS), ESLint, Prettier, Vitest.
- Verify `docker compose up -d` starts all 3 services cleanly and `/api/health` reports DB, Redis, and Meilisearch connectivity.

### Phase 2: Database Schema + TMDB Ingestion Pilot (1,000 Movies)
- Define full `prisma/schema.prisma` and run initial migration.
- Build rate-limited `TmdbClient` with exponential backoff & structured logging.
- Build idempotent `movie-ingestion` service + CLI command `sync-movies --limit=1000`.
- Verify 1,000 movies, genres, and cast/crew are stored in PostgreSQL and re-running is idempotent.

### Phase 3: Availability Ingestion (India, US, UK)
- Implement `AvailabilityProvider` abstraction and `TmdbJustWatchProvider`.
- Implement `availability-sync` service + CLI command `sync-availability --countries=IN,US,GB`.
- Store `last_checked_at` on every record; handle missing region data gracefully.
- Verify availability rows exist for `IN`, `US`, `GB` across `sub`, `free`, `rent`, `buy`.

### Phase 4: Search API + Search UI
- Configure Meilisearch `movies` index (typo tolerance, facets, ranking rules) + `reindex-search` CLI.
- Build `GET /api/search` supporting query, year, genre, language, platform, offer type, and country.
- Build dark-mode home page with Hero Search Bar, instant autocomplete dropdown, filter chips, poster grid, skeletons, and empty/error states.
- Verify `< 200 ms` search responses and typo tolerance (e.g., `"Incepton"` -> `"Inception"`).

### Phase 5: Movie Page + Platform Page + Country Selector
- Implement Country Selector in navbar (IP detection + cookie override, default `IN`).
- Build SSR `/movie/{id}-{slug}` with poster, backdrop, metadata, trailer embed, **"Where to watch"** grouped by offer type (`Stream`, `Free`, `Rent`, `Buy`), freshness timestamp, and **"Not available anywhere"** state with similar available movies.
- Build `/platform/{id}-{slug}` to browse all movies on a platform in the selected country with pagination and filters.
- Add mandatory TMDB & JustWatch footer attribution.

### Phase 6: Full Catalog Import, Daily Sync Jobs & Caching
- Set up BullMQ worker (`src/worker`) with rate-limited queues and repeatable cron schedules:
  - Daily TMDB `/movie/changes` incremental sync.
  - Frequent availability refresh for high-popularity movies vs. long-tail movies.
- Add Redis caching layer for movie pages, platform listings, and hot search queries.
- Verify background jobs process cleanly and cached movie pages return `< 1 s` TTFB.

### Phase 7: SEO, Tests, Polish & Deployment Docs
- Add `sitemap.xml`, `robots.txt`, and rich Open Graph / Twitter metadata on movie & platform pages.
- Write unit tests for ingestion normalization, availability provider abstraction, and search query/filter builders.
- Run full lint, typecheck, and test suite.
- Write comprehensive `README.md` with local Docker setup and production deployment guide (Vercel + managed Postgres/Redis/Meilisearch).
