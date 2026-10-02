import sanitizeHtml from "sanitize-html";

/** Absolute web URLs only: no script/data URLs, credentials or protocol-relative URLs. */
export function safeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i",
      "u", "s", "del", "blockquote", "ul", "ol", "li", "a", "img", "figure",
      "figcaption", "pre", "code", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
      "div", "span", "sup", "sub"
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height", "loading"],
      ol: ["start"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"]
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      img: (_tag, attributes) => ({
        tagName: "img",
        attribs: { ...attributes, src: safeUrl(attributes.src) ?? "", loading: "lazy" }
      })
    }
  });
}

/** Decode entities with the same maintained HTML parser, producing plain text. */
export function plainText(html: string): string {
  const escaped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  let text = "";
  sanitizeHtml(`<span>${escaped}</span>`, {
    allowedTags: ["span"],
    exclusiveFilter: (frame) => { text = frame.text; return true; }
  });
  return text.trim();
}
