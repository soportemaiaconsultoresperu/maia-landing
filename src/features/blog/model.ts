import type { Post, Category } from "../../types/content.ts";

export const PAGE_SIZE = 6;
export const topics = [
  { key: "all", label: "Todo", image: "TODO" },
  { key: "saneamiento-ambiental", label: "Saneamiento Ambiental", image: "SANEAMIENTO AMBIENTAL" },
  { key: "gestion-de-residuos", label: "Gestión de residuos", image: "GESTION DE RESIDUOS" },
  { key: "calidad-e-inocuidad", label: "Calidad e Inocuidad", image: "CALIDAD E INOCUIDAD" },
  { key: "gestion-empresarial", label: "Gestión empresarial", image: "GESTION EMPRESARIAL" },
  { key: "software-y-tecnologia", label: "Software y tecnología", image: "SOFTWARE Y TECNOLOGIA" },
] as const;

export function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function categoryKey(category: Category): string {
  const match = topics.find((topic) => topic.key !== "all" &&
    [normalize(category.slug), normalize(category.name)].some((value) =>
      value === normalize(topic.key) || value === normalize(topic.label)));
  return match?.key ?? `category:${category.slug}`;
}

export interface SearchEntry { search: string; categories: string[] }
export function searchEntry(post: Post): SearchEntry {
  return {
    search: normalize([post.title, post.excerpt, post.author?.name, ...(post.categories ?? []).map((category) => category.name)].join(" ")),
    categories: (post.categories ?? []).map(categoryKey),
  };
}

export function matches(entry: SearchEntry, query: string, category: string): boolean {
  return (category === "all" || entry.categories.includes(category)) &&
    normalize(query).split(/\s+/).every((word) => entry.search.includes(word));
}

export function visibleEntries<T extends SearchEntry>(entries: T[], query: string, category: string, limit = PAGE_SIZE): T[] {
  return entries.filter((entry) => matches(entry, query, category)).slice(0, limit);
}

export function newestFirst(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0));
}

export function featuredPost(posts: Post[]): Post | undefined {
  const sorted = newestFirst(posts);
  return sorted.find((post) => post.featured) ?? sorted[0];
}

// Publication timestamps are shown consistently, independently of build/browser timezone.
export function formatDate(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Lima",
  }).format(new Date(value));
}
