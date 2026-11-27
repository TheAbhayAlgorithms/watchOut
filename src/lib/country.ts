import { cookies, headers } from 'next/headers';
import {
  COUNTRY_COOKIE_NAME,
  DEFAULT_COUNTRY,
  SUPPORTED_CODES,
} from '@/lib/countries';

export {
  COUNTRY_COOKIE_NAME,
  DEFAULT_COUNTRY,
  SUPPORTED_COUNTRIES,
  normalizeCountryCode,
  getCountryName,
} from '@/lib/countries';

export async function getActiveCountry(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COUNTRY_COOKIE_NAME)?.value;
  if (fromCookie && /^[A-Z]{2}$/i.test(fromCookie)) {
    return fromCookie.toUpperCase();
  }

  const headerStore = await headers();
  const ipCountry =
    headerStore.get('x-vercel-ip-country') ??
    headerStore.get('cf-ipcountry') ??
    headerStore.get('x-country-code');

  if (ipCountry && SUPPORTED_CODES.has(ipCountry.toUpperCase())) {
    return ipCountry.toUpperCase();
  }

  return DEFAULT_COUNTRY;
}
