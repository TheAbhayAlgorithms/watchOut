import { NextRequest, NextResponse } from 'next/server';
import { getActiveCountry } from '@/lib/country';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const country = (
    request.nextUrl.searchParams.get('country') ?? (await getActiveCountry())
  ).toUpperCase();

  const platforms = await prisma.platform.findMany({
    where: {
      availability: {
        some: { countryCode: country },
      },
    },
    orderBy: [{ displayPriority: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      tmdbProviderId: true,
      name: true,
      slug: true,
      logoPath: true,
      type: true,
    },
  });

  return NextResponse.json({ country, platforms });
}
