import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeBlog } from "../src/features/blog/filters.ts";
import { searchEntry } from "../src/features/blog/model.ts";

// A small DOM contract double exercises the controller's listeners and selectors.
// Compiled Astro/browser verification remains a separate integration check.
class Element extends EventTarget {
  dataset = {};
  hidden = false;
  disabled = true;
  value = "";
  textContent = "";
  attributes = {};
  children = [];
  focused = false;
  listenerCount = 0;
  addEventListener(...args) { this.listenerCount++; super.addEventListener(...args); }
  setAttribute(key, value) { this.attributes[key] = value; }
  replaceChildren(child) { this.children = [child]; }
  querySelector(selector) { return selector === "a" ? this : null; }
  focus() { this.focused = true; }
  click() { this.dispatchEvent(new Event("click")); }
}
function fixture() {
  const posts = Array.from({ length: 9 }, (_, index) => ({
    title: `Artículo ${index}`, content: "", slug: String(index), featured: index === 2 || index === 5,
    categories: [{ name: index < 7 ? "Actualidad" : "Calidad e Inocuidad", slug: index < 7 ? "actualidad" : "calidad-e-inocuidad" }],
  }));
  const controls = Object.fromEntries(["#blog-search", "[data-more]", "[data-results]", "[data-no-results]", "[data-featured]", "[data-featured-slot]"].map((key) => [key, new Element()]));
  const entries = posts.map((post, index) => Object.assign(new Element(), { dataset: { post: String(index), featured: String(post.featured), entry: JSON.stringify(searchEntry(post)) } }));
  const buttons = ["all", "category:actualidad", "calidad-e-inocuidad", "software-y-tecnologia"].map((category) => Object.assign(new Element(), { dataset: { category } }));
  const root = new Element();
  root.querySelectorAll = (selector) => selector === "[data-post]" ? entries : buttons;
  root.querySelector = (selector) => controls[selector] ?? { content: { cloneNode: () => selector } };
  const choose = (category) => buttons.find((button) => button.dataset.category === category).click();
  const search = (value) => { controls["#blog-search"].value = value; controls["#blog-search"].dispatchEvent(new Event("input")); };
  const selected = () => controls["[data-featured-slot]"].dataset.selected;
  const visible = () => entries.filter((entry) => !entry.hidden).length;
  initializeBlog(root);
  return { root, controls, entries, buttons, choose, search, selected, visible };
}

test("featured follows topic/search, preferring the newest matching flag then newest fallback", () => {
  const f = fixture();
  assert.equal(f.selected(), "2");
  f.choose("calidad-e-inocuidad");
  assert.equal(f.selected(), "7");
  assert.equal(f.visible(), 2);
  f.choose("category:actualidad");
  assert.equal(f.selected(), "2");
  f.search("articulo 5");
  assert.equal(f.selected(), "5");
  f.search("articulo 1");
  assert.equal(f.selected(), "1");
  assert.equal(f.controls["[data-results]"].textContent, "1 de 1 artículos");
});

test("empty topics hide featured; Todo preserves active search and clear resets pagination", () => {
  const f = fixture();
  f.search("articulo 8");
  f.choose("category:actualidad");
  assert.equal(f.controls["[data-featured]"].hidden, true);
  assert.equal(f.controls["[data-no-results]"].hidden, false);
  f.choose("all");
  assert.equal(f.selected(), "8");
  assert.equal(f.visible(), 1);
  f.search("");
  assert.equal(f.visible(), 6);
  f.controls["[data-more]"].click();
  assert.equal(f.visible(), 9);
  assert.equal(f.entries[6].focused, true);
  assert.equal(f.controls["[data-more]"].hidden, true);
  f.choose("category:actualidad");
  assert.equal(f.visible(), 6);
  assert.equal(f.controls["[data-more]"].hidden, false);
  f.choose("software-y-tecnologia");
  assert.equal(f.visible(), 0);
  assert.equal(f.controls["[data-featured]"].hidden, true);
  assert.equal(f.buttons.find((b) => b.dataset.category === "software-y-tecnologia").attributes["aria-pressed"], "true");
  assert.equal(f.buttons.filter((b) => b.attributes["aria-pressed"] === "true").length, 1);
});

test("initialization is idempotent and incomplete roots remain unenhanced", () => {
  const f = fixture();
  initializeBlog(f.root);
  assert.equal(f.controls["[data-more]"].listenerCount, 1);
  assert.equal(f.controls["#blog-search"].listenerCount, 1);
  f.controls["[data-more]"].click();
  assert.equal(f.controls["[data-results]"].textContent, "9 de 9 artículos");
  assert.equal(f.buttons.every((button) => !button.disabled), true);
  const incomplete = new Element();
  assert.doesNotThrow(() => initializeBlog(incomplete));
});

test("Astro wires the controller, inert featured cards and generic icons into the shared grid", () => {
  const source = readFileSync(new URL("../src/features/blog/BlogListing.astro", import.meta.url), "utf8");
  assert.match(source, /querySelectorAll<HTMLElement>\("\[data-blog\]"\)\.forEach\(initializeBlog\)/);
  assert.match(source, /<template data-featured-template=/);
  assert.match(source, /data-post=\{String\(index\)\} data-featured=/);
  const grid = source.slice(source.indexOf('<div class="topic-grid"'), source.indexOf("<noscript>"));
  assert.match(grid, /extraCategories/);
  assert.match(grid, /<svg class="topic-icon"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(grid, /data-category=\{key\}/);
  assert.match(grid, /<span>\{name\}<\/span>/);
  assert.doesNotMatch(source, /extra-categories/);
  assert.match(source, /Recientes de todos los temas/);
});
