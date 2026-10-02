import type { Post } from "../../../types/content.ts";
import type { WordPressPost } from "../types/posts.ts";
import { plainText, safeUrl, sanitizeContent } from "../sanitize.ts";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const nullableString = (value: unknown) => value === null || typeof value === "string";

export function assertPost(value: unknown): asserts value is WordPressPost {
  if (!record(value) || typeof value.slug !== "string" || !value.slug.trim() ||
      !nullableString(value.title) || value.status !== "publish" ||
      !nullableString(value.content) || !nullableString(value.excerpt) ||
      !nullableString(value.dateGmt) || !nullableString(value.modifiedGmt) ||
      typeof value.isSticky !== "boolean") {
    throw new Error("WordPress returned an invalid or unpublished post.");
  }
  const categories = value.categories;
  if (!record(categories) || !Array.isArray(categories.nodes) ||
      !categories.nodes.every((item) => record(item) && typeof item.name === "string" &&
        typeof item.slug === "string" && !!item.slug) ||
      !record(categories.pageInfo) || categories.pageInfo.hasNextPage !== false) {
    throw new Error("WordPress post categories are invalid or exceed the 100-category limit.");
  }
  const author = value.author;
  if (author !== null && (!record(author) || (author.node !== null &&
      (!record(author.node) || typeof author.node.name !== "string" || typeof author.node.slug !== "string")))) {
    throw new Error("WordPress post author is invalid.");
  }
  const image = value.featuredImage;
  if (image !== null) {
    if (!record(image)) throw new Error("WordPress post image is invalid.");
    if (image.node !== null) {
      const node = image.node;
      if (!record(node) || !nullableString(node.sourceUrl) || !nullableString(node.altText) ||
          (node.mediaDetails !== null && (!record(node.mediaDetails) ||
            ![node.mediaDetails.width, node.mediaDetails.height].every((size) =>
              size === null || (typeof size === "number" && Number.isFinite(size) && size > 0))))) {
        throw new Error("WordPress post image is invalid.");
      }
    }
  }
}

function utcDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("WordPress post date is invalid.");
  return date.toISOString();
}

export function mapPost(value: unknown): Post {
  assertPost(value);
  const image = value.featuredImage?.node;
  const url = safeUrl(image?.sourceUrl);
  const author = value.author?.node;
  return {
    slug: value.slug,
    title: plainText(value.title ?? "") || "Artículo sin título",
    excerpt: plainText(value.excerpt ?? ""),
    content: sanitizeContent(value.content ?? ""),
    publishedAt: utcDate(value.dateGmt),
    updatedAt: utcDate(value.modifiedGmt),
    featured: value.isSticky,
    author: author ? { name: plainText(author.name), slug: author.slug } : undefined,
    categories: value.categories.nodes.map((category) => ({
      name: plainText(category.name), slug: category.slug
    })),
    cover: url && image ? {
      url,
      alt: plainText(image.altText ?? ""),
      width: image.mediaDetails?.width ?? undefined,
      height: image.mediaDetails?.height ?? undefined
    } : undefined
  };
}
