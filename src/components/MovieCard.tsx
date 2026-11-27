import Image from 'next/image';
import Link from 'next/link';
import { Film, Star } from 'lucide-react';
import { buildMoviePath } from '@/lib/slug';

export interface MovieCardItem {
  id: number;
  tmdbId: number;
  title: string;
  slug: string;
  year: number | null;
  runtime: number | null;
  posterPath: string | null;
  voteAverage: number;
  genres: string[];
  platforms: Array<{
    id: number;
    name: string;
    slug: string;
    logoPath: string | null;
    offerType: string;
  }>;
}

export function MovieCard({ movie }: { movie: MovieCardItem }) {
  const href = buildMoviePath(movie.id, movie.title);
  const visiblePlatforms = movie.platforms.slice(0, 4);
  const extraCount = Math.max(0, movie.platforms.length - 4);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/70 transition hover:border-emerald-500/60 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {movie.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${movie.posterPath}`}
            alt={`${movie.title} poster`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 18vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
            <Film className="h-8 w-8" aria-hidden="true" />
            <span className="px-2 text-center text-xs">No poster</span>
          </div>
        )}
        {movie.voteAverage > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-zinc-950/85 px-2 py-0.5 text-xs font-medium text-amber-400 backdrop-blur">
            <Star className="h-3 w-3 fill-amber-400" aria-hidden="true" />
            <span>{movie.voteAverage.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100 group-hover:text-emerald-400">
            {movie.title}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            {movie.year ?? '—'}
            {movie.genres.length > 0 ? ` • ${movie.genres.slice(0, 2).join(', ')}` : ''}
          </p>
        </div>

        {visiblePlatforms.length > 0 ? (
          <div className="flex items-center gap-1.5 pt-1">
            {visiblePlatforms.map((p) =>
              p.logoPath ? (
                <Image
                  key={p.id}
                  src={`https://image.tmdb.org/t/p/w45${p.logoPath}`}
                  alt={p.name}
                  title={p.name}
                  width={22}
                  height={22}
                  className="h-5 w-5 rounded-md object-cover ring-1 ring-zinc-700"
                />
              ) : (
                <span
                  key={p.id}
                  title={p.name}
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
                >
                  {p.name.slice(0, 6)}
                </span>
              )
            )}
            {extraCount > 0 && (
              <span className="text-[11px] font-medium text-zinc-400">+{extraCount}</span>
            )}
          </div>
        ) : (
          <p className="pt-1 text-[11px] text-zinc-500">Check regional availability</p>
        )}
      </div>
    </Link>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/50">
      <div className="aspect-[2/3] w-full animate-pulse bg-zinc-800" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}
