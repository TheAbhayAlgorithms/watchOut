import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { getMeiliClient } from '@/lib/meili';
import {
  ensureMoviesIndexSettings,
  MOVIES_INDEX,
  MovieSearchDocument,
} from '@/services/search-indexer';
import { buildMeiliFilter } from '@/services/search-service';

describe('Phase 4: Search Filter & Meilisearch Integration', () => {
  const testDocId = 99999904;

  afterAll(async () => {
    try {
      const meili = getMeiliClient();
      const task = await meili.index(MOVIES_INDEX).deleteDocument(testDocId);
      await meili.waitForTask(task.taskUid, { timeOutMs: 5000 });
    } catch {
      // ignore cleanup errors
    }
  });

  it('builds Meilisearch filter expressions accurately', () => {
    const filters = buildMeiliFilter({
      country: 'in',
      year: 2010,
      genre: 'science-fiction',
      language: 'EN',
      platformId: 8,
      offerType: 'sub',
    });

    expect(filters).toEqual([
      'year = 2010',
      'genreSlugs = "science-fiction"',
      'languages = "en"',
      'availabilityKeys = "IN:8:sub"',
    ]);
  });

  it('indexes and searches with typo tolerance in under 200ms', async () => {
    await ensureMoviesIndexSettings();
    const meili = getMeiliClient();
    const index = meili.index<MovieSearchDocument>(MOVIES_INDEX);

    const doc: MovieSearchDocument = {
      id: testDocId,
      tmdbId: 27205,
      title: 'Inception',
      originalTitle: 'Inception',
      slug: 'inception',
      year: 2010,
      runtime: 148,
      synopsis: 'A thief who steals corporate secrets through dream-sharing technology.',
      posterPath: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
      originalLanguage: 'en',
      languages: ['en', 'ja'],
      popularity: 150,
      voteAverage: 8.4,
      genreSlugs: ['action', 'science-fiction'],
      genres: ['Action', 'Science Fiction'],
      directors: ['Christopher Nolan'],
      castNames: ['Leonardo DiCaprio'],
      availableCountries: ['IN', 'US'],
      availabilityKeys: ['IN:8', 'IN:sub', 'IN:8:sub'],
      platformsByCountry: {
        IN: [{ id: 8, name: 'Netflix', slug: 'netflix', logoPath: null, offerType: 'sub' }],
      },
    };

    const addTask = await index.addDocuments([doc], { primaryKey: 'id' });
    await meili.waitForTask(addTask.taskUid, { timeOutMs: 10000 });

    const res = await index.search('Incepton', {
      filter: buildMeiliFilter({ country: 'IN', platformId: 8, offerType: 'sub' }),
    });

    expect(res.processingTimeMs).toBeLessThan(200);
    expect(res.hits.some((h) => h.id === testDocId && h.title === 'Inception')).toBe(true);
  });
});
