export const paths = {
  home: "/",
  projects: "/proyectos",
  project: (slug: string) => `/${slug}`,
  blog: "/blog",
  post: (slug: string) => `/blog/${slug}`,
  politicaPrivacidad: "/politica-privacidad",
  condicionesServicio: "/condiciones-servicio",
  eliminacionDatos: "/eliminacion-datos"
} as const;

export function toCanonicalUrl(pathname: string, baseUrl: string): string {
  return new URL(pathname, baseUrl).toString();
}

