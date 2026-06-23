export function formatDate(date: string, locale = "es-PE"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium"
  }).format(new Date(date));
}
