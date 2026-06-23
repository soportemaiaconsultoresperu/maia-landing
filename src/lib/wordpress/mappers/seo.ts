import type { SEO } from "@/types/seo";
import type { WordPressSEOFields } from "@/types/wordpress";

export function mapWordPressSEO(seo?: WordPressSEOFields | null): Partial<SEO> {
  return {
    title: seo?.title ?? undefined,
    description: seo?.metaDesc ?? undefined,
    canonical: seo?.canonical ?? undefined,
    image: seo?.opengraphImage?.sourceUrl ?? undefined
  };
}
