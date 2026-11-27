import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY_COOKIE_NAME, normalizeCountryCode } from '@/lib/country';

export async function POST(request: NextRequest) {
  let body: { country?: string } = {};
  try {
    body = (await request.json()) as { country?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const country = normalizeCountryCode(body.country);
  const response = NextResponse.json({ country });
  response.cookies.set(COUNTRY_COOKIE_NAME, country, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return response;
}
