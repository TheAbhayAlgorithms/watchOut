'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { SUPPORTED_COUNTRIES } from '@/lib/countries';

export function CountrySelector({ currentCountry }: { currentCountry: string }) {
  const router = useRouter();
  const [country, setCountry] = useState(currentCountry);
  const [saving, setSaving] = useState(false);

  const handleChange = async (nextCountry: string) => {
    setCountry(nextCountry);
    setSaving(true);
    try {
      await fetch('/api/country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: nextCountry }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-zinc-400" aria-hidden="true" />
      <label htmlFor="country-selector" className="sr-only">
        Select Country
      </label>
      <select
        id="country-selector"
        aria-label="Select country"
        value={country}
        disabled={saving}
        onChange={(e) => void handleChange(e.target.value)}
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
      >
        {SUPPORTED_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.code})
          </option>
        ))}
      </select>
    </div>
  );
}
