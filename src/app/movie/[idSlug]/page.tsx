import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OfferType } from '@prisma/client';
import { ArrowLeft, Clock, ExternalLink, Film, Star } from 'lucide-react';
import { MovieCard } from '@/components/MovieCard';
import { getActiveCountry, getCountryName } from '@/lib/country';
import { buildPlatformPath, parseIdFromSlug } from '@/lib/slug';
import { getMovieDetailForCountry, GroupedOffer } from '@/services/query-service';

export const dynamic = 'force-dynamic';

const OFFER_SECTIONS: Array<{ key: OfferType; label: string }> = [
  { key: 'sub', label: 'Stream (Subscription)' },
  { key: 'free', label: 'Free with Ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

function extractYouTubeId(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idSlug: string }>;
}): Promise<Metadata> {
  const { idSlug } = await params;
  const movieId = parseIdFromSlug(idSlug);
  if (!movieId) return { title: 'Movie Not Found — WhereToWatch' };

  const country = await getActiveCountry();
  const movie = await getMovieDetailForCountry(movieId, country);
  if (!movie) return { title: 'Movie Not Found — WhereToWatch' };

  const title = `${movie.title}${movie.year ? ` (${movie.year})` : ''} — Where to Watch`;
  const description =
    movie.synopsis ||
    `Find where to stream, rent, or buy ${movie.title} in ${getCountryName(country)}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'video.movie',
      images: movie.posterPath
        ? [`https://image.tmdb.org/t/p/w500${movie.posterPath}`]
        : undefined,
    },
  };
}

function OfferRow({ offer }: { offer: GroupedOffer }) {
  const platformHref = buildPlatformPath(offer.platformId, offer.platformName);
  const priceLabel =
    offer.price && offer.currency ? `${offer.currency} ${offer.price}` : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <Link
        href={platformHref}
        className="flex items-center gap-3 hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        {offer.logoPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w92${offer.logoPath}`}
            alt={offer.platformName}
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-cover ring-1 ring-zinc-700"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300">
            {offer.platformName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-white">{offer.platformName}</p>
          {priceLabel && <p className="text-xs text-zinc-400">{priceLabel}</p>}
        </div>
      </Link>

      {offer.deepLink ? (
        <a
          href={offer.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          <span>Watch</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : (
        <Link
          href={platformHref}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
        >
          Browse
        </Link>
      )}
    </div>
  );
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ idSlug: string }>;
}) {
  const { idSlug } = await params;
  const movieId = parseIdFromSlug(idSlug);
  if (!movieId) notFound();

  const country = await getActiveCountry();
  const countryName = getCountryName(country);
  const movie = await getMovieDetailForCountry(movieId, country);
  if (!movie) notFound();

  const youtubeId = extractYouTubeId(movie.trailerUrl);

  return (
    <div className="pb-16">
      {/* Backdrop Hero */}
      <div className="relative border-b border-zinc-800/80 bg-zinc-900/40">
        {movie.backdropPath && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
            <Image
              src={`https://image.tmdb.org/t/p/w1280${movie.backdropPath}`}
              alt=""
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
          </div>
        )}

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to search</span>
          </Link>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Poster */}
            <div className="relative aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:w-60">
              {movie.posterPath ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                  alt={`${movie.title} poster`}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
                  <Film className="h-10 w-10" aria-hidden="true" />
                  <span className="text-xs">No poster</span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex flex-1 flex-col justify-center">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {movie.title}
              </h1>
              {movie.originalTitle !== movie.title && (
                <p className="mt-1 text-sm text-zinc-400">{movie.originalTitle}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                {movie.year && <span>{movie.year}</span>}
                {movie.runtime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                    {movie.runtime} min
                  </span>
                )}
                {movie.voteAverage > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" aria-hidden="true" />
                    {movie.voteAverage.toFixed(1)} TMDB
                  </span>
                )}
                {movie.imdbRating && (
                  <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-200">
                    IMDb {movie.imdbRating}
                  </span>
                )}
                {movie.rottenTomatoesScore !== null && (
                  <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-200">
                    RT {movie.rottenTomatoesScore}%
                  </span>
                )}
              </div>

              {movie.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {movie.genres.map((g) => (
                    <span
                      key={g.slug}
                      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {movie.synopsis && (
                <p className="mt-5 max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
                  {movie.synopsis}
                </p>
              )}

              <dl className="mt-6 grid grid-cols-1 gap-3 text-xs text-zinc-400 sm:grid-cols-3">
                {movie.directors.length > 0 && (
                  <div>
                    <dt className="font-semibold text-zinc-300">Director</dt>
                    <dd className="mt-0.5">{movie.directors.map((d) => d.name).join(', ')}</dd>
                  </div>
                )}
                {movie.languages.length > 0 && (
                  <div>
                    <dt className="font-semibold text-zinc-300">Languages</dt>
                    <dd className="mt-0.5 uppercase">{movie.languages.join(', ')}</dd>
                  </div>
                )}
                {movie.countries.length > 0 && (
                  <div>
                    <dt className="font-semibold text-zinc-300">Countries</dt>
                    <dd className="mt-0.5">{movie.countries.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Where to Watch */}
      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-white">
            Where to watch in {countryName} ({country})
          </h2>
          {movie.lastCheckedAt && (
            <p className="text-xs text-zinc-500">
              Last updated: {new Date(movie.lastCheckedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {movie.hasAnyOffer ? (
          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            {OFFER_SECTIONS.map(({ key, label }) => {
              const list = movie.offers[key];
              if (list.length === 0) return null;
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4"
                >
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">{label}</h3>
                  <div className="space-y-2.5">
                    {list.map((offer) => (
                      <OfferRow key={`${offer.platformId}-${offer.offerType}`} offer={offer} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
            <p className="text-base font-medium text-zinc-200">
              No streaming info available for your region ({countryName}).
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Try switching countries in the top right, or explore similar movies streaming now.
            </p>
          </div>
        )}
      </section>

      {/* Top Cast */}
      {movie.topCast.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
          <h2 className="text-xl font-bold text-white">Top Cast</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {movie.topCast.map((member) => (
              <div
                key={member.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3"
              >
                <p className="truncate text-sm font-medium text-zinc-100">{member.name}</p>
                {member.character && (
                  <p className="truncate text-xs text-zinc-400">{member.character}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trailer */}
      {youtubeId && (
        <section className="mx-auto mt-12 max-w-4xl px-4 sm:px-6">
          <h2 className="mb-4 text-xl font-bold text-white">Trailer</h2>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              title={`${movie.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </section>
      )}

      {/* Similar Available Movies */}
      {movie.similarAvailable.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
          <h2 className="mb-4 text-xl font-bold text-white">
            Similar movies available in {countryName}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {movie.similarAvailable.map((sim) => (
              <MovieCard key={sim.id} movie={sim} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
