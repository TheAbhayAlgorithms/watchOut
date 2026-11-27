import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { searchMovies } from '@/services/search-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const q = searchParams.get('q') ?? '';
  const country = searchParams.get('country') ?? 'IN';
  const yearRaw = searchParams.get('year');
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const genre = searchParams.get('genre') ?? undefined;
  const language = searchParams.get('language') ?? undefined;
  const platformRaw = searchParams.get('platformId');
  const platformId = platformRaw ? Number.parseInt(platformRaw, 10) : null;
  const offerType = searchParams.get('offerType') ?? undefined;
  const pageRaw = searchParams.get('page');
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 24;

  try {
    const data = await searchMovies({
      q,
      country,
      year: year && Number.isFinite(year) ? year : null,
      genre,
      language,
      platformId: platformId && Number.isFinite(platformId) ? platformId : null,
      offerType,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 24,
    });

    return NextResponse.json(data);
  } catch (err) {
    logger.error({ err }, 'Search API failed');
    return NextResponse.json(
      { error: 'Search service unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
