import type { Post } from "../../types/content.ts";
import { wordpressEndpoint, wordpressRequest, type WordPressClientOptions } from "./client.ts";
import { mapPost } from "./mappers/posts.ts";
import { postsIndexQuery } from "./queries/posts.ts";
import type { PostsPage } from "./types/posts.ts";

export type PostCollection =
  | { state: "unconfigured"; posts: Post[] }
  | { state: "ready"; posts: Post[] };

interface LoadPostsOptions extends WordPressClientOptions {
  pageSize?: number;
  maxPages?: number;
  collectionTimeoutMs?: number;
}

/** Fetch a fresh, complete published collection for static routes. Never caches partial data. */
export async function loadPosts(options: LoadPostsOptions = {}): Promise<PostCollection> {
  const endpoint = (options.endpoint ?? wordpressEndpoint())?.trim();
  if (!endpoint) return { state: "unconfigured", posts: [] };
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 1_000;
  const collectionTimeoutMs = options.collectionTimeoutMs ?? 60_000;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !Number.isInteger(maxPages) || maxPages < 1 ||
      !Number.isFinite(collectionTimeoutMs) || collectionTimeoutMs <= 0 ||
      (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0))) {
    throw new Error("Invalid WordPress collection limits.");
  }
  const deadline = Date.now() + collectionTimeoutMs;
  const posts: Post[] = [];
  const slugs = new Set<string>();
  const cursors = new Set<string>();
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("WordPress collection timed out.");
    const data: PostsPage = await wordpressRequest<PostsPage, { first: number; after: string | null }>({
      ...options,
      endpoint,
      timeoutMs: Math.min(options.timeoutMs ?? 10_000, remaining),
      query: postsIndexQuery,
      variables: { first: pageSize, after }
    });
    const connection = data.posts;
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo ||
        typeof connection.pageInfo.hasNextPage !== "boolean" ||
        !(connection.pageInfo.endCursor === null || typeof connection.pageInfo.endCursor === "string")) {
      throw new Error("WordPress returned a malformed posts connection.");
    }
    for (const node of connection.nodes) {
      const post = mapPost(node);
      if (slugs.has(post.slug)) throw new Error("WordPress returned duplicate posts; collection changed during pagination.");
      slugs.add(post.slug);
      posts.push(post);
    }
    const { hasNextPage, endCursor } = connection.pageInfo;
    if (!hasNextPage) return { state: "ready", posts };
    if (!connection.nodes.length || !endCursor?.trim() || cursors.has(endCursor)) {
      throw new Error("WordPress pagination did not advance or repeated a cursor.");
    }
    cursors.add(endCursor);
    after = endCursor;
  }
  throw new Error("WordPress exceeded the pagination page limit; refusing a partial collection.");
}
