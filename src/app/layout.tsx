import type { Metadata } from 'next';
import Link from 'next/link';
import { CountrySelector } from '@/components/CountrySelector';
import { getActiveCountry } from '@/lib/country';
import './globals.css';

export const metadata: Metadata = {
  title: 'WhereToWatch — Find Where Any Movie Streams',
  description:
    'Search any movie in the world and instantly see which streaming platforms carry it in your country.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const country = await getActiveCountry();

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 antialiased">
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-bold text-zinc-950">
                W
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">WhereToWatch</span>
            </Link>
            <CountrySelector currentCountry={country} />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-xs text-zinc-400">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>WhereToWatch is a movie discovery guide and does not host or stream video content.</p>
            <p>
              Movie metadata by{' '}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-200 underline hover:text-white"
              >
                TMDB
              </a>
              . Streaming availability data powered by{' '}
              <a
                href="https://www.justwatch.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-200 underline hover:text-white"
              >
                JustWatch
              </a>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
