import 'dotenv/config';
import { describe, expect, it, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { buildMoviePath, parseIdFromSlug, slugify } from '@/lib/slug';
import { TmdbClient, TmdbConfigError, TmdbMovieDetail } from '@/providers/tmdb-client';
import { normalizeTmdbMovie, upsertNormalizedMovie } from '@/services/movie-ingestion';

const SAMPLE_DETAIL: TmdbMovieDetail = {
  id: 99999901,
  imdb_id: 'tt1375666',
  title: 'Inception (Test)',
  original_title: 'Inception',
  release_date: '2010-07-16',
  runtime: 148,
  overview: 'A thief who steals corporate secrets through dream-sharing technology.',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  original_language: 'en',
  spoken_languages: [
    { iso_639_1: 'en', english_name: 'English' },
    { iso_639_1: 'ja', english_name: 'Japanese' },
  ],
  production_countries: [
    { iso_3166_1: 'US', name: 'United States of America' },
    { iso_3166_1: 'GB', name: 'United Kingdom' },
  ],
  popularity: 120.5,
  vote_average: 8.4,
  vote_count: 35000,
  genres: [
    { id: 9901, name: 'Action' },
    { id: 9902, name: 'Science Fiction' },
  ],
  credits: {
    cast: [
      { id: 99101, name: 'Leonardo DiCaprio', character: 'Cobb', profile_path: null, order: 0 },
    ],
    crew: [
      { id: 99201, name: 'Christopher Nolan', job: 'Director', profile_path: null },
    ],
  },
  videos: {
    results: [
      { key: 'YoHD9XEInc0', site: 'YouTube', type: 'Trailer', official: true },
    ],
  },
  similar: {
    results: [{ id: 157336 }],
  },
};

describe('Phase 2: Movie Ingestion & Normalization', () => {
  afterAll(async () => {
    await prisma.movie.deleteMany({ where: { tmdbId: 99999901 } });
    await prisma.genre.deleteMany({ where: { tmdbId: { in: [9901, 9902] } } });
    await prisma.person.deleteMany({ where: { tmdbId: { in: [99101, 99201] } } });
    await prisma.$disconnect();
  });

  it('builds and parses clean movie slugs', () => {
    expect(slugify('Inception: The Dream!')).toBe('inception-the-dream');
    expect(buildMoviePath(27205, 'Inception')).toBe('/movie/27205-inception');
    expect(parseIdFromSlug('27205-inception')).toBe(27205);
    expect(parseIdFromSlug('invalid')).toBeNull();
  });

  it('normalizes TMDB movie detail payload accurately', () => {
    const normalized = normalizeTmdbMovie(SAMPLE_DETAIL);
    expect(normalized.year).toBe(2010);
    expect(normalized.runtime).toBe(148);
    expect(normalized.languages).toEqual(['en', 'ja']);
    expect(normalized.countries).toEqual(['US', 'GB']);
    expect(normalized.trailerUrl).toBe('https://www.youtube.com/watch?v=YoHD9XEInc0');
    expect(normalized.genres).toHaveLength(2);
    expect(normalized.cast.some((c) => c.roleType === 'crew' && c.job === 'Director')).toBe(true);
    expect(normalized.similarTmdbIds).toEqual([157336]);
  });

  it('throws TmdbConfigError when TMDB credentials are missing', async () => {
    const client = new TmdbClient({ apiKey: '', readAccessToken: '' });
    await expect(client.discoverMovies(1)).rejects.toThrow(TmdbConfigError);
  });

  it('upserts a normalized movie idempotently into PostgreSQL', async () => {
    const normalized = normalizeTmdbMovie(SAMPLE_DETAIL);
    const id1 = await upsertNormalizedMovie(normalized);
    const id2 = await upsertNormalizedMovie({ ...normalized, popularity: 130.0 });

    expect(id1).toBe(id2);

    const dbMovie = await prisma.movie.findUnique({
      where: { id: id1 },
      include: { genres: true, cast: true },
    });

    expect(dbMovie).not.toBeNull();
    expect(dbMovie?.popularity).toBe(130.0);
    expect(dbMovie?.genres).toHaveLength(2);
    expect(dbMovie?.cast).toHaveLength(2);
  });
});
