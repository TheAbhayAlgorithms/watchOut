import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { getActiveCountry, getCountryName } from '@/lib/country';
import { buildPlatformPath, parseIdFromSlug } from '@/lib/slug';
import { getPlatformCatalog } from '@/services/query-service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idSlug: string }>;
}): Promise<Metadata> {
  const { idSlug } = await params;
  const platformId = parseIdFromSlug(idSlug);
  if (!platformId) return { title: 'Platform Not Found — WhereToWatch' };

  const country = await getActiveCountry();
  const data = await getPlatformCatalog({ platformId, countryCode: country, limit: 1 });
  if (!data) return { title: 'Platform Not Found — WhereToWatch' };

  const title = `Movies on ${data.platform.name} (${getCountryName(country)}) — WhereToWatch`;
  return {
    title,
    description: `Browse all movies available on ${data.platform.name} in ${getCountryName(country)}.`,
  };
}

export default async function PlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{ idSlug: string }>;
  searchParams: Promise<{ genre?: string; year?: string; offerType?: string; page?: string }>;
}) {
  const { idSlug } = await params;
  const sp = await searchParams;
  const platformId = parseIdFromSlug(idSlug);
  if (!platformId) notFound();

  const country = await getActiveCountry();
  const countryName = getCountryName(country);
  const page = sp.page ? Math.max(1, Number.parseInt(sp.page, 10) || 1) : 1;
  const year = sp.year ? Number.parseInt(sp.year, 10) || null : null;

  const data = await getPlatformCatalog({
    platformId,
    countryCode: country,
    genre: sp.genre,
    year,
    offerType: sp.offerType,
    page,
    limit: 24,
  });

  if (!data) notFound();

  const basePath = buildPlatformPath(data.platform.id, data.platform.name);
  const buildPageHref = (nextPage: number) => {
    const q = new URLSearchParams();
    if (sp.genre) q.set('genre', sp.genre);
    if (sp.year) q.set('year', sp.year);
    if (sp.offerType) q.set('offerType', sp.offerType);
    q.set('page', String(nextPage));
    return `${basePath}?${q.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to search</span>
      </Link>

      <div className="flex items-center gap-4">
        {data.platform.logoPath && (
          <Image
            src={`https://image.tmdb.org/t/p/w92${data.platform.logoPath}`}
            alt={data.platform.name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl object-cover ring-1 ring-zinc-700"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Everything on {data.platform.name} in {countryName}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {data.total} {data.total === 1 ? 'movie' : 'movies'} available
          </p>
        </div>
      </div>

      {/* Simple GET Filter Form */}
      <form
        method="GET"
        action={basePath}
        className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3"
      >
        <select
          name="genre"
          aria-label="Filter by genre"
          defaultValue={sp.genre ?? ''}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
        >
          <option value="">All Genres</option>
          {data.genres.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          name="offerType"
          aria-label="Filter by offer type"
          defaultValue={sp.offerType ?? ''}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
        >
          <option value="">All Offer Types</option>
          <option value="sub">Subscription</option>
          <option value="free">Free / Ads</option>
          <option value="rent">Rent</option>
          <option value="buy">Buy</option>
        </select>

        <input
          type="number"
          name="year"
          aria-label="Filter by year"
          placeholder="Year"
          defaultValue={sp.year ?? ''}
          className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
        />

        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Apply
        </button>
      </form>

      {data.items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-base font-medium text-zinc-200">
            No movies found on {data.platform.name} in {countryName} for these filters.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.items.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          {data.page > 1 && (
            <Link
              href={buildPageHref(data.page - 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
            >
              Previous
            </Link>
          )}
          <span className="text-xs text-zinc-400">
            Page {data.page} of {data.totalPages}
          </span>
          {data.page < data.totalPages && (
            <Link
              href={buildPageHref(data.page + 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
