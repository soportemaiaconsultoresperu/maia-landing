import { matches, PAGE_SIZE, type SearchEntry } from "./model.ts";

const initialized = new WeakSet<HTMLElement>();

/** Enhance the readable SSR listing; featured templates stay inert until selected. */
export function initializeBlog(root: HTMLElement): void {
  if (initialized.has(root)) return;
  const input = root.querySelector<HTMLInputElement>("#blog-search");
  const more = root.querySelector<HTMLButtonElement>("[data-more]");
  const results = root.querySelector<HTMLElement>("[data-results]");
  const empty = root.querySelector<HTMLElement>("[data-no-results]");
  const featured = root.querySelector<HTMLElement>("[data-featured]");
  const slot = root.querySelector<HTMLElement>("[data-featured-slot]");
  if (!input || !more || !results || !empty || !featured || !slot) return;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-category]")];
  const entries = [...root.querySelectorAll<HTMLElement>("[data-post]")].map((element) => ({
    element,
    entry: JSON.parse(element.dataset.entry!) as SearchEntry,
    template: root.querySelector<HTMLTemplateElement>(`[data-featured-template="${element.dataset.post}"]`),
  }));
  let category = "all";
  let limit = PAGE_SIZE;
  function update() {
    // SSR entries are newest-first, so the first matching flagged post wins.
    const matching = entries.filter(({ entry }) => matches(entry, input!.value, category));
    const selected = matching.find(({ element }) => element.dataset.featured === "true") ?? matching[0];
    featured!.hidden = !selected;
    if (selected && slot!.dataset.selected !== selected.element.dataset.post) {
      if (selected.template) {
        slot!.replaceChildren(selected.template.content.cloneNode(true));
        slot!.dataset.selected = selected.element.dataset.post;
      }
    }
    const visible = new Set(matching.slice(0, limit));
    entries.forEach((entry) => { entry.element.hidden = !visible.has(entry); });
    buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.category === category)));
    more!.hidden = matching.length <= limit;
    empty!.hidden = matching.length !== 0 || entries.length === 0;
    results!.hidden = entries.length === 0;
    results!.textContent = `${Math.min(limit, matching.length)} de ${matching.length} artículos`;
  }
  initialized.add(root);
  buttons.forEach((button) => {
    button.disabled = false;
    button.addEventListener("click", () => { category = button.dataset.category!; limit = PAGE_SIZE; update(); });
  });
  input.disabled = false;
  input.addEventListener("input", () => { limit = PAGE_SIZE; update(); });
  more.addEventListener("click", () => {
    const previous = entries.filter(({ element }) => !element.hidden).length;
    limit += PAGE_SIZE;
    update();
    entries.filter(({ element }) => !element.hidden)[previous]?.element.querySelector<HTMLAnchorElement>("a")?.focus();
  });
  update();
}
