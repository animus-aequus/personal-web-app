import { redirect } from "next/navigation";

import { CHAT_PATH } from "@/lib/site-paths";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function searchParamsToQuery(
  params: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          query.append(key, item);
        }
      }
    } else if (value) {
      query.set(key, value);
    }
  }
  return query.toString();
}

/** Canonical chat lives at `/chat`. Preserve `?invite=` (and any other query). */
export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const qs = searchParamsToQuery(params);
  redirect(qs ? `${CHAT_PATH}?${qs}` : CHAT_PATH);
}
