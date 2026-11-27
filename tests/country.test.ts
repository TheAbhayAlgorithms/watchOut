import { describe, expect, it } from 'vitest';
import { getCountryName, normalizeCountryCode } from '@/lib/countries';

describe('Phase 7: Country Helpers', () => {
  it('normalizes valid ISO alpha-2 country codes and falls back to default', () => {
    expect(normalizeCountryCode('us')).toBe('US');
    expect(normalizeCountryCode(' gb ')).toBe('GB');
    expect(normalizeCountryCode('invalid')).toBe('IN');
    expect(normalizeCountryCode(null)).toBe('IN');
  });

  it('resolves human-readable country names', () => {
    expect(getCountryName('IN')).toBe('India');
    expect(getCountryName('US')).toBe('United States');
    expect(getCountryName('GB')).toBe('United Kingdom');
    expect(getCountryName('ZZ')).toBe('ZZ');
  });
});
