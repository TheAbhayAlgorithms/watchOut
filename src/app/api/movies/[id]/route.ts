import { NextRequest, NextResponse } from 'next/server';
import { getActiveCountry } from '@/lib/country';
import { getMovieDetailForCountry } from '@/services/query-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const movieId = Number.parseInt(id, 10);
  if (!Number.isFinite(movieId) || movieId <= 0) {
    return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 });
  }

  const country = request.nextUrl.searchParams.get('country') ?? (await getActiveCountry());
  const detail = await getMovieDetailForCountry(movieId, country);
  if (!detail) {
    return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
  }

  return NextResponse.json(detail);
}
