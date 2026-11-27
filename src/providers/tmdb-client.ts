import { logger } from '@/lib/logger';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  order?: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path: string | null;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

export interface TmdbMovieSummary {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbMovieDetail extends TmdbMovieSummary {
  imdb_id?: string | null;
  runtime?: number | null;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  original_language?: string;
  spoken_languages?: Array<{ iso_639_1: string; english_name?: string; name?: string }>;
  production_countries?: Array<{ iso_3166_1: string; name?: string }>;
  genres?: TmdbGenre[];
  credits?: {
    cast?: TmdbCastMember[];
    crew?: TmdbCrewMember[];
  };
  videos?: {
    results?: TmdbVideo[];
  };
  external_ids?: {
    imdb_id?: string | null;
  };
  similar?: {
    results?: Array<{ id: number }>;
  };
}

export interface TmdbDiscoverResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovieSummary[];
}

export interface TmdbProviderItem {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

export interface TmdbCountryWatchProviders {
  link?: string;
  flatrate?: TmdbProviderItem[];
  free?: TmdbProviderItem[];
  ads?: TmdbProviderItem[];
  rent?: TmdbProviderItem[];
  buy?: TmdbProviderItem[];
}

export interface TmdbWatchProvidersResponse {
  id: number;
  results: Record<string, TmdbCountryWatchProviders>;
}

export interface TmdbChangesResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: Array<{ id: number; adult?: boolean | null }>;
}

export class TmdbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TmdbConfigError';
  }
}

export class TmdbClient {
  private readonly apiKey: string;
  private readonly readAccessToken: string;
  private readonly minIntervalMs: number;
  private lastRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options?: {
    apiKey?: string;
    readAccessToken?: string;
    requestsPerSecond?: number;
  }) {
    this.apiKey = (options?.apiKey ?? process.env.TMDB_API_KEY ?? '').trim();
    this.readAccessToken = (
      options?.readAccessToken ??
      process.env.TMDB_READ_ACCESS_TOKEN ??
      ''
    ).trim();
    const rps = options?.requestsPerSecond ?? 30;
    this.minIntervalMs = Math.ceil(1000 / Math.max(1, rps));
  }

  public isConfigured(): boolean {
    return Boolean(this.readAccessToken || this.apiKey);
  }

  private scheduleRateLimit(): Promise<void> {
    const run = this.queue.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.lastRequestAt + this.minIntervalMs - now);
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastRequestAt = Date.now();
    });
    this.queue = run.catch(() => {});
    return run;
  }

  public async request<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    maxRetries = 4
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new TmdbConfigError(
        'TMDB credentials missing. Set TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN in .env.'
      );
    }

    const url = new URL(`${TMDB_BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.readAccessToken) {
      headers.Authorization = `Bearer ${this.readAccessToken}`;
    } else if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await this.scheduleRateLimit();
      const res = await fetch(url.toString(), { headers });

      if (res.ok) {
        return (await res.json()) as T;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === maxRetries) {
        const body = await res.text().catch(() => '');
        throw new Error(`TMDB HTTP ${res.status} on ${path}: ${body.slice(0, 200)}`);
      }

      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfterSec = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : NaN;
      const baseDelay = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : Math.min(15000, 500 * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 250);
      const delayMs = baseDelay + jitter;

      logger.warn({ path, status: res.status, attempt, delayMs }, 'TMDB rate-limited/error, retrying');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(`TMDB request exhausted retries for ${path}`);
  }

  public discoverMovies(
    page = 1,
    sortBy: 'popularity.desc' | 'vote_count.desc' = 'popularity.desc'
  ): Promise<TmdbDiscoverResponse> {
    return this.request<TmdbDiscoverResponse>('/discover/movie', {
      page,
      sort_by: sortBy,
      include_adult: 'false',
      include_video: 'false',
      'vote_count.gte': 10,
    });
  }

  public getMovieDetails(tmdbId: number): Promise<TmdbMovieDetail> {
    return this.request<TmdbMovieDetail>(`/movie/${tmdbId}`, {
      append_to_response: 'credits,videos,external_ids,similar',
    });
  }

  public getWatchProviders(tmdbId: number): Promise<TmdbWatchProvidersResponse> {
    return this.request<TmdbWatchProvidersResponse>(`/movie/${tmdbId}/watch/providers`);
  }

  public getMovieChanges(
    startDate: string,
    endDate: string,
    page = 1
  ): Promise<TmdbChangesResponse> {
    return this.request<TmdbChangesResponse>('/movie/changes', {
      start_date: startDate,
      end_date: endDate,
      page,
    });
  }
}
