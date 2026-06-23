export const paths = {
  home: "/",
  projects: "/proyectos",
  project: (slug: string) => `/${slug}`,
  blog: "/blog",
  post: (slug: string) => `/blog/${slug}`
} as const;

export function toCanonicalUrl(pathname: string, baseUrl: string): string {
  return new URL(pathname, baseUrl).toString();
}
