import { siteConfig } from "@/lib/config/site";
import { toCanonicalUrl } from "@/lib/routes/paths";
import type { SEO } from "@/types/seo";

interface ResolveSEOInput {
  title?: string;
  description?: string;
  pathname: string;
  seo?: Partial<SEO>;
}

export function resolveSEO(input: ResolveSEOInput): SEO {
  const title = input.seo?.title ?? input.title ?? siteConfig.name;
  const description =
    input.seo?.description ?? input.description ?? siteConfig.description;

  return {
    title,
    description,
    canonical: input.seo?.canonical ?? toCanonicalUrl(input.pathname, siteConfig.url),
    image: input.seo?.image,
    robots: input.seo?.robots,
    type: input.seo?.type ?? "website",
    publishedTime: input.seo?.publishedTime,
    modifiedTime: input.seo?.modifiedTime
  };
}
