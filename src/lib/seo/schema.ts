import { siteConfig } from "@/lib/config/site";
import type { SEO } from "@/types/seo";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url
  };
}

export function webpageSchema(seo: SEO) {
  return {
    "@context": "https://schema.org",
    "@type": seo.type === "article" ? "Article" : "WebPage",
    headline: seo.title,
    description: seo.description,
    url: seo.canonical,
    datePublished: seo.publishedTime,
    dateModified: seo.modifiedTime
  };
}
