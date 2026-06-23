import type { SEO } from "./seo";

export interface Media {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface Author {
  name: string;
  slug?: string;
  avatar?: Media;
}

export interface Category {
  name: string;
  slug: string;
}

export interface Page {
  title: string;
  slug: string;
  content?: string;
  seo?: Partial<SEO>;
}

export interface Project {
  title: string;
  slug: string;
  excerpt?: string;
  cover?: Media;
  seo?: Partial<SEO>;
}

export interface Post {
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt?: string;
  updatedAt?: string;
  author?: Author;
  categories?: Category[];
  cover?: Media;
  seo?: Partial<SEO>;
}
