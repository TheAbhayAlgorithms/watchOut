import { SearchExperience } from '@/components/SearchExperience';
import { getActiveCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const country = await getActiveCountry();
  return <SearchExperience initialCountry={country} />;
}
