import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'WhereToWatch — Find Where Any Movie Is Streaming',
  description:
    'Search any movie in the world and instantly see which streaming, rent, or buy platforms carry it in your country.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950 font-black">
                W
              </span>
              <span>WhereToWatch</span>
            </Link>
            <div className="text-xs text-zinc-400">Region: India (IN)</div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 text-sm text-zinc-400">
          <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} WhereToWatch. Discovery only — no video hosted.</p>
            <p className="text-xs text-zinc-500 text-center sm:text-right">
              Movie metadata provided by{' '}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-300"
              >
                TMDB
              </a>
              . Streaming availability data powered by{' '}
              <a
                href="https://www.justwatch.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-300"
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
