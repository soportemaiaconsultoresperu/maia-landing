export type SEOType = "website" | "article" | "project";

export interface SEO {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  robots?: string;
  type?: SEOType;
  publishedTime?: string;
  modifiedTime?: string;
}
