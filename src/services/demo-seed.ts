import { TmdbMovieDetail, TmdbCountryWatchProviders } from '@/providers/tmdb-client';
import { AvailabilityProvider } from '@/providers/types';
import { normalizeTmdbWatchProviders } from '@/providers/tmdb-availability';
import { upsertMovieAvailability } from '@/services/availability-sync';
import { normalizeTmdbMovie, upsertNormalizedMovie } from '@/services/movie-ingestion';
import { reindexAllMovies } from '@/services/search-indexer';

interface DemoMovieEntry {
  detail: TmdbMovieDetail;
  providers: Record<string, TmdbCountryWatchProviders>;
}

const DEMO_MOVIES: DemoMovieEntry[] = [
  {
    detail: {
      id: 27205,
      imdb_id: 'tt1375666',
      title: 'Inception',
      original_title: 'Inception',
      release_date: '2010-07-16',
      runtime: 148,
      overview:
        'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: inception.',
      poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
      backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
      original_language: 'en',
      spoken_languages: [
        { iso_639_1: 'en', english_name: 'English' },
        { iso_639_1: 'ja', english_name: 'Japanese' },
      ],
      production_countries: [
        { iso_3166_1: 'US', name: 'United States of America' },
        { iso_3166_1: 'GB', name: 'United Kingdom' },
      ],
      popularity: 185.4,
      vote_average: 8.4,
      vote_count: 36000,
      genres: [
        { id: 28, name: 'Action' },
        { id: 878, name: 'Science Fiction' },
        { id: 12, name: 'Adventure' },
      ],
      credits: {
        cast: [
          { id: 6193, name: 'Leonardo DiCaprio', character: 'Dom Cobb', profile_path: null, order: 0 },
          { id: 24045, name: 'Joseph Gordon-Levitt', character: 'Arthur', profile_path: null, order: 1 },
          { id: 27578, name: 'Elliot Page', character: 'Ariadne', profile_path: null, order: 2 },
          { id: 2524, name: 'Tom Hardy', character: 'Eames', profile_path: null, order: 3 },
        ],
        crew: [{ id: 525, name: 'Christopher Nolan', job: 'Director', profile_path: null }],
      },
      videos: {
        results: [{ key: 'YoHD9XEInc0', site: 'YouTube', type: 'Trailer', official: true }],
      },
      similar: { results: [{ id: 157336 }, { id: 155 }] },
    },
    providers: {
      IN: {
        link: 'https://www.themoviedb.org/movie/27205-inception/watch?locale=IN',
        flatrate: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', display_priority: 1 },
          { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/dQeAar5H991VYporEjUspolDarG.jpg', display_priority: 2 },
        ],
        rent: [
          { provider_id: 2, provider_name: 'Apple TV', logo_path: '/9ghgSC0MA082EL6HLCW3GalykFD.jpg', display_priority: 3 },
          { provider_id: 3, provider_name: 'Google Play Movies', logo_path: '/8z7rC8uIDaTM91X0ZfkRf04ydj2.jpg', display_priority: 4 },
        ],
        buy: [
          { provider_id: 2, provider_name: 'Apple TV', logo_path: '/9ghgSC0MA082EL6HLCW3GalykFD.jpg', display_priority: 3 },
        ],
      },
      US: {
        link: 'https://www.themoviedb.org/movie/27205-inception/watch?locale=US',
        flatrate: [
          { provider_id: 1899, provider_name: 'Max', logo_path: '/fksCUZ9QDWZMUwL2LgMtLckROUN.jpg', display_priority: 1 },
        ],
        rent: [
          { provider_id: 10, provider_name: 'Amazon Video', logo_path: '/seGSXajazLMCKGB5hnRCidtjay1.jpg', display_priority: 2 },
        ],
      },
      GB: {
        link: 'https://www.themoviedb.org/movie/27205-inception/watch?locale=GB',
        flatrate: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', display_priority: 1 },
        ],
      },
    },
  },
  {
    detail: {
      id: 157336,
      imdb_id: 'tt0816692',
      title: 'Interstellar',
      original_title: 'Interstellar',
      release_date: '2014-11-05',
      runtime: 169,
      overview:
        'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
      poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
      original_language: 'en',
      spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
      production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
      popularity: 210.2,
      vote_average: 8.4,
      vote_count: 35000,
      genres: [
        { id: 12, name: 'Adventure' },
        { id: 18, name: 'Drama' },
        { id: 878, name: 'Science Fiction' },
      ],
      credits: {
        cast: [
          { id: 10297, name: 'Matthew McConaughey', character: 'Cooper', profile_path: null, order: 0 },
          { id: 1813, name: 'Anne Hathaway', character: 'Brand', profile_path: null, order: 1 },
        ],
        crew: [{ id: 525, name: 'Christopher Nolan', job: 'Director', profile_path: null }],
      },
      videos: {
        results: [{ key: 'zSWdZVtXT7E', site: 'YouTube', type: 'Trailer', official: true }],
      },
      similar: { results: [{ id: 27205 }, { id: 438631 }] },
    },
    providers: {
      IN: {
        link: 'https://www.themoviedb.org/movie/157336-interstellar/watch?locale=IN',
        flatrate: [
          { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/dQeAar5H991VYporEjUspolDarG.jpg', display_priority: 1 },
        ],
        rent: [
          { provider_id: 2, provider_name: 'Apple TV', logo_path: '/9ghgSC0MA082EL6HLCW3GalykFD.jpg', display_priority: 2 },
        ],
      },
      US: {
        link: 'https://www.themoviedb.org/movie/157336-interstellar/watch?locale=US',
        flatrate: [
          { provider_id: 531, provider_name: 'Paramount Plus', logo_path: '/h5DcR0J2EESLitnhR8xLG1QymTE.jpg', display_priority: 1 },
        ],
      },
      GB: {
        link: 'https://www.themoviedb.org/movie/157336-interstellar/watch?locale=GB',
        flatrate: [
          { provider_id: 9, provider_name: 'Amazon Prime Video', logo_path: '/dQeAar5H991VYporEjUspolDarG.jpg', display_priority: 1 },
        ],
      },
    },
  },
  {
    detail: {
      id: 155,
      imdb_id: 'tt0468569',
      title: 'The Dark Knight',
      original_title: 'The Dark Knight',
      release_date: '2008-07-16',
      runtime: 152,
      overview:
        'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.',
      poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
      backdrop_path: '/dqK9Hag1054tghRQSqLSfrkvQnA.jpg',
      original_language: 'en',
      spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
      production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
      popularity: 165.0,
      vote_average: 8.5,
      vote_count: 32000,
      genres: [
        { id: 28, name: 'Action' },
        { id: 80, name: 'Crime' },
        { id: 18, name: 'Drama' },
      ],
      credits: {
        cast: [
          { id: 3894, name: 'Christian Bale', character: 'Bruce Wayne / Batman', profile_path: null, order: 0 },
          { id: 1810, name: 'Heath Ledger', character: 'Joker', profile_path: null, order: 1 },
        ],
        crew: [{ id: 525, name: 'Christopher Nolan', job: 'Director', profile_path: null }],
      },
      videos: {
        results: [{ key: 'EXeTwQWrcwY', site: 'YouTube', type: 'Trailer', official: true }],
      },
      similar: { results: [{ id: 27205 }] },
    },
    providers: {
      IN: {
        link: 'https://www.themoviedb.org/movie/155-the-dark-knight/watch?locale=IN',
        flatrate: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', display_priority: 1 },
        ],
      },
      US: {
        link: 'https://www.themoviedb.org/movie/155-the-dark-knight/watch?locale=US',
        flatrate: [
          { provider_id: 1899, provider_name: 'Max', logo_path: '/fksCUZ9QDWZMUwL2LgMtLckROUN.jpg', display_priority: 1 },
        ],
      },
    },
  },
  {
    detail: {
      id: 579974,
      imdb_id: 'tt8178634',
      title: 'RRR',
      original_title: 'రౌద్రం రణం రుధిరం',
      release_date: '2022-03-24',
      runtime: 182,
      overview:
        'A fictional history of two legendary revolutionaries away from home before they began fighting for their country in the 1920s.',
      poster_path: '/u0XUBNQjrO66p8a4q13yV1c7H8r.jpg',
      backdrop_path: '/nEufeZlyAOLqO2brrs0yeF1lgXO.jpg',
      original_language: 'te',
      spoken_languages: [
        { iso_639_1: 'te', english_name: 'Telugu' },
        { iso_639_1: 'hi', english_name: 'Hindi' },
        { iso_639_1: 'en', english_name: 'English' },
      ],
      production_countries: [{ iso_3166_1: 'IN', name: 'India' }],
      popularity: 140.5,
      vote_average: 7.8,
      vote_count: 1400,
      genres: [
        { id: 28, name: 'Action' },
        { id: 18, name: 'Drama' },
      ],
      credits: {
        cast: [
          { id: 148037, name: 'N.T. Rama Rao Jr.', character: 'Komaram Bheem', profile_path: null, order: 0 },
          { id: 147023, name: 'Ram Charan', character: 'Alluri Sitarama Raju', profile_path: null, order: 1 },
        ],
        crew: [{ id: 147021, name: 'S. S. Rajamouli', job: 'Director', profile_path: null }],
      },
      videos: {
        results: [{ key: 'f_vbAtFSEc0', site: 'YouTube', type: 'Trailer', official: true }],
      },
      similar: { results: [{ id: 27205 }] },
    },
    providers: {
      IN: {
        link: 'https://www.themoviedb.org/movie/579974-rrr/watch?locale=IN',
        flatrate: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', display_priority: 1 },
          { provider_id: 232, provider_name: 'Zee5', logo_path: '/ajbCmwMJZu1t1XWTtstzpL16h0T.jpg', display_priority: 2 },
          { provider_id: 122, provider_name: 'Disney Plus Hotstar', logo_path: '/7Fl8ylPDclt3ZYgNbW2t7rbZE9I.jpg', display_priority: 3 },
        ],
      },
      US: {
        link: 'https://www.themoviedb.org/movie/579974-rrr/watch?locale=US',
        flatrate: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', display_priority: 1 },
        ],
      },
    },
  },
  {
    detail: {
      id: 20453,
      imdb_id: 'tt1187043',
      title: '3 Idiots',
      original_title: '3 Idiots',
      release_date: '2009-12-25',
      runtime: 170,
      overview:
        'Rascal. Joker. Dreamer. Genius... You have never met a college student like Rancho. From the moment he arrives at India’s most prestigious university, Rancho’s outlandish schemes turn the campus upside down.',
      poster_path: '/66A9MqXOyVFCssoloscw79z8Tew.jpg',
      backdrop_path: '/8a2s6c1n8n9m2Z5t2x7v8h2m6fJ.jpg',
      original_language: 'hi',
      spoken_languages: [{ iso_639_1: 'hi', english_name: 'Hindi' }],
      production_countries: [{ iso_3166_1: 'IN', name: 'India' }],
      popularity: 112.0,
      vote_average: 8.0,
      vote_count: 2500,
      genres: [
        { id: 18, name: 'Drama' },
        { id: 35, name: 'Comedy' },
      ],
      credits: {
        cast: [
          { id: 52763, name: 'Aamir Khan', character: 'Rancho', profile_path: null, order: 0 },
          { id: 85722, name: 'R. Madhavan', character: 'Farhan Qureshi', profile_path: null, order: 1 },
        ],
        crew: [{ id: 85720, name: 'Rajkumar Hirani', job: 'Director', profile_path: null }],
      },
      videos: {
        results: [{ key: 'K0eDlFX9GMc', site: 'YouTube', type: 'Trailer', official: true }],
      },
      similar: { results: [] },
    },
    providers: {
      IN: {
        link: 'https://www.themoviedb.org/movie/20453-3-idiots/watch?locale=IN',
        flatrate: [
          { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/dQeAar5H991VYporEjUspolDarG.jpg', display_priority: 1 },
          { provider_id: 237, provider_name: 'SonyLIV', logo_path: '/od22ftNnyag0TTxcnJhlsu3aLoU.jpg', display_priority: 2 },
        ],
        free: [
          { provider_id: 192, provider_name: 'YouTube', logo_path: '/pTnn5JwWr4p3pG8H6VrpiQo7Vs0.jpg', display_priority: 5 },
        ],
      },
    },
  },
  {
    detail: {
      id: 496243,
      imdb_id: 'tt6751668',
      title: 'Parasite',
      original_title: '기생충',
      release_date: '2019-05-30',
      runtime: 133,
      overview:
        'All unemployed, Ki-taek’s family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.',
      poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
      backdrop_path: '/ApiBzeaa95TNYliSbQ8pJv4Fje7.jpg',
      original_language: 'ko',
      spoken_languages: [{ iso_639_1: 'ko', english_name: 'Korean' }],
      production_countries: [{ iso_3166_1: 'KR', name: 'South Korea' }],
      popularity: 130.1,
      vote_average: 8.5,
      vote_count: 18000,
      genres: [
        { id: 35, name: 'Comedy' },
        { id: 53, name: 'Thriller' },
        { id: 18, name: 'Drama' },
      ],
      credits: {
        cast: [{ id: 20738, name: 'Song Kang-ho', character: 'Kim Ki-taek', profile_path: null, order: 0 }],
        crew: [{ id: 21684, name: 'Bong Joon-ho', job: 'Director', profile_path: null }],
      },
      videos: {
        results: [{ key: '5xH0HfJHsaY', site: 'YouTube', type: 'Trailer', official: true }],
      },
      similar: { results: [{ id: 27205 }] },
    },
    providers: {
      // Intentionally no IN offers to demonstrate "No streaming info available for your region" + similar available movies!
      US: {
        link: 'https://www.themoviedb.org/movie/496243-parasite/watch?locale=US',
        flatrate: [
          { provider_id: 15, provider_name: 'Hulu', logo_path: '/bxBlRPEPpMVDc4jMhSrTf2339DW.jpg', display_priority: 1 },
        ],
      },
      GB: {
        link: 'https://www.themoviedb.org/movie/496243-parasite/watch?locale=GB',
        rent: [
          { provider_id: 2, provider_name: 'Apple TV', logo_path: '/9ghgSC0MA082EL6HLCW3GalykFD.jpg', display_priority: 2 },
        ],
      },
    },
  },
];

export async function seedDemoCatalog(): Promise<{ seeded: number }> {
  let seeded = 0;

  for (const entry of DEMO_MOVIES) {
    const normalized = normalizeTmdbMovie(entry.detail);
    const movieId = await upsertNormalizedMovie(normalized);

    const demoProvider: AvailabilityProvider = {
      name: 'tmdb_justwatch',
      async fetchMovieAvailability(_ids, countries) {
        return {
          source: 'tmdb_justwatch',
          offers: normalizeTmdbWatchProviders(entry.providers, countries),
          checkedAt: new Date(),
        };
      },
    };

    await upsertMovieAvailability(
      movieId,
      { tmdbId: entry.detail.id, imdbId: entry.detail.imdb_id },
      ['IN', 'US', 'GB'],
      demoProvider
    );
    seeded++;
  }

  await reindexAllMovies();
  return { seeded };
}
