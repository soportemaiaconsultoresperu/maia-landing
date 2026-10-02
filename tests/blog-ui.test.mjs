import test from "node:test";
import assert from "node:assert/strict";
import { categoryKey, searchEntry, matches, visibleEntries, featuredPost, newestFirst, formatDate, PAGE_SIZE } from "../src/features/blog/model.ts";

const post = (overrides = {}) => ({ title: "Calidad de alimentos", slug: "calidad", content: "", featured: false, ...overrides });

test("fixed topics resolve accent-insensitive CMS names or slugs; extra categories survive", () => {
  assert.equal(categoryKey({ name: "Gestión de residuos", slug: "residuos" }), "gestion-de-residuos");
  assert.equal(categoryKey({ name: "Otro nombre", slug: "calidad-e-inocuidad" }), "calidad-e-inocuidad");
  assert.equal(categoryKey({ name: "Actualidad", slug: "actualidad" }), "category:actualidad");
});

test("search combines every query word with the selected category", () => {
  const entry = searchEntry(post({ excerpt: "Gestión segura", categories: [{ name: "Calidad e Inocuidad", slug: "calidad" }] }));
  assert.equal(matches(entry, "GESTION alimentos", "calidad-e-inocuidad"), true);
  assert.equal(matches(entry, "gestión", "saneamiento-ambiental"), false);
  assert.equal(matches(entry, "desconocido", "all"), false);
  assert.equal(matches(entry, "", "all"), true);
});

test("pagination reveals six at a time and default limit resets on a new filter", () => {
  const entries = Array.from({ length: 15 }, (_, index) => searchEntry(post({ title: `Artículo ${index}` })));
  assert.equal(PAGE_SIZE, 6);
  assert.equal(visibleEntries(entries, "", "all").length, 6);
  assert.equal(visibleEntries(entries, "", "all", 12).length, 12);
  assert.equal(visibleEntries(entries, "articulo", "all").length, 6);
  assert.equal(visibleEntries(entries, "", "missing").length, 0);
  assert.deepEqual(visibleEntries([], "", "all"), []);
});

test("newest sticky wins, otherwise newest post; source collection is untouched", () => {
  const old = post({ slug: "old", publishedAt: "2025-01-01T00:00:00Z", featured: true });
  const sticky = post({ slug: "sticky", publishedAt: "2025-02-01T00:00:00Z", featured: true });
  const latest = post({ slug: "latest", publishedAt: "2025-03-01T00:00:00Z" });
  const posts = [old, latest, sticky];
  assert.equal(featuredPost(posts), sticky);
  assert.equal(featuredPost([old, latest].map((item) => ({ ...item, featured: false }))).slug, "latest");
  assert.equal(newestFirst(posts)[0], latest);
  assert.equal(posts[0], old);
  assert.equal(featuredPost([]), undefined);
});

test("dates consistently use Lima time and safely omit missing or invalid values", () => {
  const expected = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }).format(new Date("2026-04-11T01:30:00Z"));
  assert.equal(formatDate("2026-04-11T01:30:00Z"), expected);
  assert.equal(formatDate("not a date"), "");
  assert.equal(formatDate(), "");
});
