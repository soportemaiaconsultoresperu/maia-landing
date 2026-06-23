const previewCookieName = "maia_preview";

interface PreviewCookies {
  has: (name: string) => boolean;
}

export function getPreviewCookieName(): string {
  return previewCookieName;
}

export function isPreviewEnabled(cookies: PreviewCookies): boolean {
  return cookies.has(previewCookieName);
}
