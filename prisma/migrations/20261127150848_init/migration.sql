-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('cast', 'crew');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('sub', 'free', 'rent', 'buy');

-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('subscription', 'free', 'transactional', 'mixed');

-- CreateTable
CREATE TABLE "movies" (
    "id" SERIAL NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "imdb_id" TEXT,
    "title" TEXT NOT NULL,
    "original_title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "year" INTEGER,
    "release_date" TIMESTAMP(3),
    "runtime" INTEGER,
    "synopsis" TEXT NOT NULL DEFAULT '',
    "poster_path" TEXT,
    "backdrop_path" TEXT,
    "original_language" TEXT NOT NULL DEFAULT 'en',
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "popularity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vote_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "imdb_rating" DOUBLE PRECISION,
    "rotten_tomatoes_score" INTEGER,
    "trailer_url" TEXT,
    "similar_tmdb_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_genres" (
    "movie_id" INTEGER NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "movie_genres_pkey" PRIMARY KEY ("movie_id","genre_id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" SERIAL NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "profile_path" TEXT,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_cast" (
    "id" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "role_type" "RoleType" NOT NULL,
    "character" TEXT,
    "job" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "movie_cast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" SERIAL NOT NULL,
    "tmdb_provider_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_path" TEXT,
    "type" "PlatformType" NOT NULL DEFAULT 'mixed',
    "display_priority" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "offer_type" "OfferType" NOT NULL,
    "price" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "deep_link" TEXT,
    "source" TEXT NOT NULL DEFAULT 'tmdb_justwatch',
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_summary" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movies_tmdb_id_key" ON "movies"("tmdb_id");

-- CreateIndex
CREATE INDEX "movies_imdb_id_idx" ON "movies"("imdb_id");

-- CreateIndex
CREATE INDEX "movies_year_idx" ON "movies"("year");

-- CreateIndex
CREATE INDEX "movies_popularity_idx" ON "movies"("popularity" DESC);

-- CreateIndex
CREATE INDEX "movies_title_idx" ON "movies"("title");

-- CreateIndex
CREATE UNIQUE INDEX "genres_tmdb_id_key" ON "genres"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "movie_genres_genre_id_idx" ON "movie_genres"("genre_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_tmdb_id_key" ON "people"("tmdb_id");

-- CreateIndex
CREATE INDEX "movie_cast_movie_id_role_type_idx" ON "movie_cast"("movie_id", "role_type");

-- CreateIndex
CREATE INDEX "movie_cast_person_id_idx" ON "movie_cast"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_tmdb_provider_id_key" ON "platforms"("tmdb_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "availability_country_code_platform_id_idx" ON "availability"("country_code", "platform_id");

-- CreateIndex
CREATE INDEX "availability_movie_id_country_code_idx" ON "availability"("movie_id", "country_code");

-- CreateIndex
CREATE INDEX "availability_last_checked_at_idx" ON "availability"("last_checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "availability_movie_id_platform_id_country_code_offer_type_key" ON "availability"("movie_id", "platform_id", "country_code", "offer_type");

-- CreateIndex
CREATE INDEX "sync_logs_job_type_started_at_idx" ON "sync_logs"("job_type", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_cast" ADD CONSTRAINT "movie_cast_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_cast" ADD CONSTRAINT "movie_cast_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
