'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { buildMoviePath } from '@/lib/slug';
import { MovieCard, MovieCardItem, MovieCardSkeleton } from '@/components/MovieCard';

interface FilterOptions {
  genres: Array<{ name: string; slug: string }>;
  platforms: Array<{ id: number; name: string; slug: string; logoPath: string | null }>;
}

const LANGUAGES = [
  { code: '', label: 'All Languages' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
];

const OFFER_TYPES = [
  { value: '', label: 'All Offers' },
  { value: 'sub', label: 'Subscription' },
  { value: 'free', label: 'Free / Ads' },
  { value: 'rent', label: 'Rent' },
  { value: 'buy', label: 'Buy' },
];

export function SearchExperience({ initialCountry = 'IN' }: { initialCountry?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [offerType, setOfferType] = useState('');

  const [results, setResults] = useState<MovieCardItem[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<MovieCardItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    genres: [],
    platforms: [],
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/filters?country=${encodeURIComponent(initialCountry)}`)
      .then((res) => (res.ok ? res.json() : { genres: [], platforms: [] }))
      .then((data: FilterOptions) => {
        if (!cancelled) setFilterOptions(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialCountry]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('country', initialCountry);
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      if (year.trim()) params.set('year', year.trim());
      if (genre) params.set('genre', genre);
      if (language) params.set('language', language);
      if (platformId) params.set('platformId', platformId);
      if (offerType) params.set('offerType', offerType);

      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error('Search request failed');
      const data = await res.json();
      setResults(data.hits ?? []);
      setTotalHits(data.totalHits ?? 0);
      setProcessingTimeMs(data.processingTimeMs ?? null);

      if (debouncedQuery.trim().length > 0) {
        setSuggestions((data.hits ?? []).slice(0, 6));
      } else {
        setSuggestions([]);
      }
    } catch {
      setError('Unable to load search results right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, genre, initialCountry, language, offerType, platformId, year]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      const chosen = suggestions[activeIndex];
      setShowSuggestions(false);
      router.push(buildMoviePath(chosen.id, chosen.title));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const hasFilters = Boolean(year || genre || language || platformId || offerType || query);

  const clearAll = () => {
    setQuery('');
    setYear('');
    setGenre('');
    setLanguage('');
    setPlatformId('');
    setOfferType('');
    setShowSuggestions(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Hero Search */}
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Find where any movie streams.
        </h1>
        <p className="mt-3 text-sm text-zinc-400 sm:text-base">
          Search across subscription, free, rent, and buy options in your country.
        </p>

        <div ref={searchContainerRef} className="relative mt-7 text-left">
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-4 h-5 w-5 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              role="combobox"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-autocomplete="list"
              aria-controls="movie-autocomplete-list"
              aria-label="Search for any movie"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search movies (e.g., Inception, RRR, Interstellar)..."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-4 pr-12 pl-12 text-base text-white shadow-lg placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="absolute right-3 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <ul
              id="movie-autocomplete-list"
              role="listbox"
              className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            >
              {suggestions.map((item, idx) => (
                <li key={item.id} role="option" aria-selected={idx === activeIndex}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuggestions(false);
                      router.push(buildMoviePath(item.id, item.title));
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                      idx === activeIndex
                        ? 'bg-emerald-500/20 text-white'
                        : 'text-zinc-200 hover:bg-zinc-800/80'
                    }`}
                  >
                    <span className="font-medium">
                      {item.title}{' '}
                      {item.year && <span className="text-zinc-400">({item.year})</span>}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {item.platforms
                        .slice(0, 2)
                        .map((p) => p.name)
                        .join(', ') || 'View details'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>Filters</span>
        </div>

        <select
          aria-label="Filter by genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Genres</option>
          {filterOptions.genres.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code || 'all'} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by platform"
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Platforms</option>
          {filterOptions.platforms.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by offer type"
          value={offerType}
          onChange={(e) => setOfferType(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
        >
          {OFFER_TYPES.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          aria-label="Filter by release year"
          placeholder="Year"
          min={1900}
          max={2030}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10"
          >
            Reset
          </button>
        )}
      </section>

      {/* Results Header */}
      <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
        <span>
          {loading
            ? 'Searching...'
            : `${totalHits} ${totalHits === 1 ? 'movie' : 'movies'} found`}
        </span>
        {processingTimeMs !== null && !loading && (
          <span>{processingTimeMs} ms</span>
        )}
      </div>

      {/* Results Grid / States */}
      {error ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-base font-medium text-zinc-200">No matching movies found</p>
          <p className="mt-1 text-sm text-zinc-400">
            Try a different title, check spelling, or clear active filters.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
}
