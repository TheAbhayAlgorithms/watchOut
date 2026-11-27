import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { buildMoviePath, buildPlatformPath } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  try {
    const [movies, platforms] = await Promise.all([
      prisma.movie.findMany({
        orderBy: { popularity: 'desc' },
        take: 5000,
        select: { id: true, title: true, updatedAt: true },
      }),
      prisma.platform.findMany({
        orderBy: { displayPriority: 'asc' },
        take: 200,
        select: { id: true, name: true },
      }),
    ]);

    for (const movie of movies) {
      entries.push({
        url: `${baseUrl}${buildMoviePath(movie.id, movie.title)}`,
        lastModified: movie.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    for (const platform of platforms) {
      entries.push({
        url: `${baseUrl}${buildPlatformPath(platform.id, platform.name)}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
  } catch {
    // Gracefully return base entry if DB is unreachable during build
  }

  return entries;
}
