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

const mediaClasses = ["alignleft", "alignright", "aligncenter", "alignwide", "alignfull"];
const aspectClasses = ["wp-embed-aspect-16-9", "wp-embed-aspect-4-3", "wp-embed-aspect-1-1",
  "wp-embed-aspect-9-16", "wp-embed-aspect-3-2", "wp-embed-aspect-21-9"];

/** Bound geometry to finite positive values; never pass arbitrary CSS through. */
function positive(value: string): boolean {
  return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number(value) > 0 && Number(value) <= 10000;
}
function dimension(value: string | undefined): string | undefined {
  return value && /^\d+$/.test(value) && positive(value) ? String(Number(value)) : undefined;
}
function sizing(style = ""): string {
  const declarations: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const match = declaration.trim().match(/^(width|height|aspect-ratio)\s*:\s*(.+)$/i);
    if (!match) continue;
    const property = match[1].toLowerCase();
    const value = match[2].trim();
    if (property === "width") {
      const size = value.match(/^((?:\d+(?:\.\d+)?|\.\d+))(px|%)$/);
      if (size && positive(size[1]) && (size[2] !== "%" || Number(size[1]) <= 100)) declarations.width = value;
    } else if (property === "height" && value === "auto") {
      declarations.height = "auto";
    } else if (property === "aspect-ratio") {
      const parts = value.split(/\s*\/\s*/);
      const ratio = Number(parts[0]) / (parts.length === 2 ? Number(parts[1]) : 1);
      if (parts.length <= 2 && parts.every(positive) && ratio >= .0001 && ratio <= 10000) {
        declarations[property] = parts.join(" / ");
      }
    }
  }
  // Edited widths scale proportionally; fixed heights are intentionally not retained.
  if (declarations.width) declarations.height = "auto";
  return Object.entries(declarations).map(([key, value]) => `${key}:${value}`).join(";");
}
function mediaAttributes(attributes: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ["width", "height"] as const) {
    const value = dimension(attributes[key]);
    if (value) result[key] = value;
  }
  const style = sizing(attributes.style);
  if (style) result.style = style;
  if (attributes.class) result.class = attributes.class;
  return result;
}

/** Only the verified provider's literal embed URL shape is admitted, not URL-normalized aliases. */
function youtubeEmbed(value = ""): string | undefined {
  const match = value.match(/^https:\/\/www\.youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:\?feature=oembed)?$/);
  return match && match[0] === value ? `https://www.youtube.com/embed/${match[1]}` : undefined;
}

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i",
      "u", "s", "del", "blockquote", "ul", "ol", "li", "a", "img", "figure",
      "figcaption", "pre", "code", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
      "div", "span", "sup", "sub", "iframe", "video", "source"
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height", "loading", "class", "style"],
      figure: ["class", "style"],
      div: ["class"],
      iframe: ["src", "title", "width", "height", "style", "loading", "referrerpolicy", "allow", "allowfullscreen"],
      video: ["src", "poster", "width", "height", "class", "style", "controls", "preload", "playsinline"],
      source: ["src", "type"],
      ol: ["start"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"]
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedClasses: {
      img: mediaClasses,
      video: mediaClasses,
      figure: [...mediaClasses, ...aspectClasses, "wp-block-image", "size-full", "is-resized",
        "wp-block-video", "wp-block-embed", "is-type-video", "is-provider-youtube",
        "wp-block-embed-youtube", "wp-has-aspect-ratio"],
      div: ["wp-block-embed__wrapper"]
    },
    // Styles are rebuilt above; the sanitizer still checks the exact output vocabulary.
    allowedStyles: {
      "*": {
        width: [/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)$/],
        height: [/^auto$/],
        "aspect-ratio": [/^(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*(?:\d+(?:\.\d+)?|\.\d+))?$/]
      }
    },
    allowedSchemesByTag: { img: ["http", "https"], video: ["http", "https"], source: ["http", "https"], iframe: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      img: (_tag, attributes) => ({
        tagName: "img",
        attribs: { ...mediaAttributes(attributes), src: safeUrl(attributes.src) ?? "", alt: attributes.alt ?? "", loading: "lazy" }
      }),
      figure: (_tag, attributes) => ({ tagName: "figure", attribs: { class: attributes.class ?? "", style: sizing(attributes.style) } }),
      iframe: (_tag, attributes) => {
        const src = "srcdoc" in attributes ? undefined : youtubeEmbed(attributes.src);
        if (!src) return { tagName: "iframe", attribs: {} };
        const width = dimension(attributes.width);
        const height = dimension(attributes.height);
        return {
          tagName: "iframe",
          attribs: {
            src, title: plainText(attributes.title ?? "") || "Video de YouTube",
            loading: "lazy", referrerpolicy: "strict-origin-when-cross-origin",
            allow: "encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "",
            ...(width && height ? { width, height, style: `aspect-ratio:${width} / ${height}` } : {})
          }
        };
      },
      video: (_tag, attributes) => ({
        tagName: "video",
        attribs: {
          ...mediaAttributes(attributes), src: safeUrl(attributes.src) ?? "",
          poster: safeUrl(attributes.poster) ?? "", controls: "", preload: "metadata", playsinline: ""
        }
      }),
      source: (_tag, attributes) => {
        const validType = !attributes.type || /^(video\/mp4|video\/webm|video\/ogg)$/.test(attributes.type);
        return {
          tagName: "source",
          attribs: { src: validType ? safeUrl(attributes.src) ?? "" : "", ...(attributes.type && validType ? { type: attributes.type } : {}) }
        };
      }
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === "iframe" || frame.tag === "source") return !frame.attribs.src;
      return false;
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
