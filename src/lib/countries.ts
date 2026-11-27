export const COUNTRY_COOKIE_NAME = 'wtw_country';
export const DEFAULT_COUNTRY = (process.env.DEFAULT_COUNTRY ?? 'IN').toUpperCase();

export interface SupportedCountry {
  code: string;
  name: string;
}

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
];

export const SUPPORTED_CODES = new Set(SUPPORTED_COUNTRIES.map((c) => c.code));

export function normalizeCountryCode(raw?: string | null): string {
  const code = raw?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) {
    return code;
  }
  return DEFAULT_COUNTRY;
}

export function getCountryName(code: string): string {
  const upper = code.toUpperCase();
  return SUPPORTED_COUNTRIES.find((c) => c.code === upper)?.name ?? upper;
}
