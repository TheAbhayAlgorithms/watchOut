import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getFilterOptions } from '@/services/search-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get('country') ?? 'IN';
  try {
    const options = await getFilterOptions(country);
    return NextResponse.json(options);
  } catch (err) {
    logger.error({ err }, 'Filters API failed');
    return NextResponse.json({ genres: [], platforms: [] }, { status: 500 });
  }
}
