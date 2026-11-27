export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

export function buildMoviePath(id: number, title: string): string {
  return `/movie/${id}-${slugify(title)}`;
}

export function buildPlatformPath(id: number, name: string): string {
  return `/platform/${id}-${slugify(name)}`;
}

export function parseIdFromSlug(idSlug: string): number | null {
  const match = /^(\d+)/.exec(idSlug.trim());
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
