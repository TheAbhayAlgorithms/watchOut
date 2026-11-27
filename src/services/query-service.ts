import { OfferType, Prisma, RoleType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { MovieCardItem } from '@/components/MovieCard';

export interface GroupedOffer {
  platformId: number;
  platformName: string;
  platformSlug: string;
  logoPath: string | null;
  offerType: OfferType;
  price: string | null;
  currency: string | null;
  deepLink: string | null;
  lastCheckedAt: string;
}

export interface MovieDetailResult {
  id: number;
  tmdbId: number;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  slug: string;
  year: number | null;
  runtime: number | null;
  synopsis: string;
  posterPath: string | null;
  backdropPath: string | null;
  originalLanguage: string;
  languages: string[];
  countries: string[];
  voteAverage: number;
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
  trailerUrl: string | null;
  genres: Array<{ name: string; slug: string }>;
  directors: Array<{ id: number; name: string }>;
  topCast: Array<{ id: number; name: string; character: string | null; profilePath: string | null }>;
  offers: Record<OfferType, GroupedOffer[]>;
  hasAnyOffer: boolean;
  lastCheckedAt: string | null;
  similarAvailable: MovieCardItem[];
}

export async function getMovieDetailForCountry(
  movieId: number,
  countryCode: string
): Promise<MovieDetailResult | null> {
  const country = countryCode.trim().toUpperCase();

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, orderBy: { order: 'asc' } },
      availability: {
        where: { countryCode: country },
        include: { platform: true },
        orderBy: { platform: { displayPriority: 'asc' } },
      },
    },
  });

  if (!movie) return null;

  const grouped: Record<OfferType, GroupedOffer[]> = {
    sub: [],
    free: [],
    rent: [],
    buy: [],
  };

  let latestCheck: Date | null = null;
  for (const avail of movie.availability) {
    if (!latestCheck || avail.lastCheckedAt > latestCheck) {
      latestCheck = avail.lastCheckedAt;
    }
    grouped[avail.offerType].push({
      platformId: avail.platform.id,
      platformName: avail.platform.name,
      platformSlug: avail.platform.slug,
      logoPath: avail.platform.logoPath,
      offerType: avail.offerType,
      price: avail.price ? avail.price.toString() : null,
      currency: avail.currency,
      deepLink: avail.deepLink,
      lastCheckedAt: avail.lastCheckedAt.toISOString(),
    });
  }

  const hasAnyOffer = movie.availability.length > 0;
  const genreIds = movie.genres.map((g) => g.genreId);

  // Similar movies that ARE available in this country
  const similarRows = await prisma.movie.findMany({
    where: {
      id: { not: movie.id },
      availability: { some: { countryCode: country } },
      OR: [
        ...(movie.similarTmdbIds.length > 0
          ? [{ tmdbId: { in: movie.similarTmdbIds } }]
          : []),
        ...(genreIds.length > 0
          ? [{ genres: { some: { genreId: { in: genreIds } } } }]
          : []),
      ],
    },
    orderBy: { popularity: 'desc' },
    take: 6,
    include: {
      genres: { include: { genre: true } },
      availability: {
        where: { countryCode: country },
        include: { platform: true },
      },
    },
  });

  const similarAvailable: MovieCardItem[] = similarRows.map((m) => {
    const seenPlatforms = new Set<number>();
    const platforms = m.availability
      .filter((a) => {
        if (seenPlatforms.has(a.platformId)) return false;
        seenPlatforms.add(a.platformId);
        return true;
      })
      .map((a) => ({
        id: a.platform.id,
        name: a.platform.name,
        slug: a.platform.slug,
        logoPath: a.platform.logoPath,
        offerType: a.offerType,
      }));

    return {
      id: m.id,
      tmdbId: m.tmdbId,
      title: m.title,
      slug: m.slug,
      year: m.year,
      runtime: m.runtime,
      posterPath: m.posterPath,
      voteAverage: m.voteAverage,
      genres: m.genres.map((g) => g.genre.name),
      platforms,
    };
  });

  return {
    id: movie.id,
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId,
    title: movie.title,
    originalTitle: movie.originalTitle,
    slug: movie.slug,
    year: movie.year,
    runtime: movie.runtime,
    synopsis: movie.synopsis,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    originalLanguage: movie.originalLanguage,
    languages: movie.languages,
    countries: movie.countries,
    voteAverage: movie.voteAverage,
    imdbRating: movie.imdbRating,
    rottenTomatoesScore: movie.rottenTomatoesScore,
    trailerUrl: movie.trailerUrl,
    genres: movie.genres.map((g) => ({ name: g.genre.name, slug: g.genre.slug })),
    directors: movie.cast
      .filter((c) => c.roleType === RoleType.crew && c.job === 'Director')
      .map((c) => ({ id: c.person.id, name: c.person.name })),
    topCast: movie.cast
      .filter((c) => c.roleType === RoleType.cast)
      .slice(0, 10)
      .map((c) => ({
        id: c.person.id,
        name: c.person.name,
        character: c.character,
        profilePath: c.person.profilePath,
      })),
    offers: grouped,
    hasAnyOffer,
    lastCheckedAt: latestCheck ? latestCheck.toISOString() : null,
    similarAvailable,
  };
}

export async function getPlatformCatalog(params: {
  platformId: number;
  countryCode: string;
  genre?: string;
  year?: number | null;
  offerType?: string;
  page?: number;
  limit?: number;
}) {
  const country = params.countryCode.trim().toUpperCase();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(48, Math.max(1, params.limit ?? 24));

  const platform = await prisma.platform.findUnique({
    where: { id: params.platformId },
  });
  if (!platform) return null;

  const validOfferType =
    params.offerType && ['sub', 'free', 'rent', 'buy'].includes(params.offerType)
      ? (params.offerType as OfferType)
      : undefined;

  const where: Prisma.MovieWhereInput = {
    availability: {
      some: {
        platformId: platform.id,
        countryCode: country,
        ...(validOfferType ? { offerType: validOfferType } : {}),
      },
    },
    ...(params.year ? { year: params.year } : {}),
    ...(params.genre ? { genres: { some: { genre: { slug: params.genre } } } } : {}),
  };

  const [total, movies, genres] = await Promise.all([
    prisma.movie.count({ where }),
    prisma.movie.findMany({
      where,
      orderBy: { popularity: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        genres: { include: { genre: true } },
        availability: {
          where: { countryCode: country, platformId: platform.id },
          include: { platform: true },
        },
      },
    }),
    prisma.genre.findMany({ orderBy: { name: 'asc' }, select: { name: true, slug: true } }),
  ]);

  const items: MovieCardItem[] = movies.map((m) => ({
    id: m.id,
    tmdbId: m.tmdbId,
    title: m.title,
    slug: m.slug,
    year: m.year,
    runtime: m.runtime,
    posterPath: m.posterPath,
    voteAverage: m.voteAverage,
    genres: m.genres.map((g) => g.genre.name),
    platforms: m.availability.slice(0, 1).map((a) => ({
      id: a.platform.id,
      name: a.platform.name,
      slug: a.platform.slug,
      logoPath: a.platform.logoPath,
      offerType: a.offerType,
    })),
  }));

  return {
    platform,
    country,
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    genres,
  };
}
