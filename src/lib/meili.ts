import { MeiliSearch } from 'meilisearch';

const globalForMeili = globalThis as unknown as {
  meili?: MeiliSearch;
};

export function getMeiliClient(): MeiliSearch {
  if (!globalForMeili.meili) {
    globalForMeili.meili = new MeiliSearch({
      host: process.env.MEILI_URL ?? 'http://localhost:7700',
      apiKey: process.env.MEILI_MASTER_KEY ?? 'wheretowatch_meili_dev_key',
    });
  }
  return globalForMeili.meili;
}
