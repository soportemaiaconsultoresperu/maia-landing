import test from "node:test";
import assert from "node:assert/strict";
import { loadPosts } from "../src/lib/wordpress/posts.ts";
import { mapPost } from "../src/lib/wordpress/mappers/posts.ts";
import { plainText, safeUrl, sanitizeContent } from "../src/lib/wordpress/sanitize.ts";

const endpoint = "https://cms.example.test/graphql";
const post = (slug = "article", overrides = {}) => ({
  slug, status: "publish", title: "Hello &amp; <em>world</em>",
  excerpt: "<p>A useful article</p>", content: "<p>Article <strong>body</strong></p>",
  dateGmt: "2026-01-02T03:04:05", modifiedGmt: "2026-02-03T04:05:06",
  isSticky: true,
  author: { node: { name: "Author &amp; team", slug: "author" } },
  categories: { nodes: [{ name: "Gestión empresarial", slug: "gestion-empresarial" }], pageInfo: { hasNextPage: false } },
  featuredImage: { node: { sourceUrl: "https://cms.example.test/photo.jpg", altText: "Cover", mediaDetails: { width: 800, height: 600 } } },
  ...overrides
});
const response = (nodes = [], hasNextPage = false, endCursor = null) =>
  new Response(JSON.stringify({ data: { posts: { nodes, pageInfo: { hasNextPage, endCursor } } } }));
const pages = (...responses) => async () => {
  assert.ok(responses.length, "unexpected additional fetch");
  return responses.shift();
};

test("missing endpoint is explicitly unconfigured and does not fetch", async () => {
  assert.deepEqual(await loadPosts({ endpoint: " ", fetch: () => assert.fail("must not fetch") }),
    { state: "unconfigured", posts: [] });
});

test("configured empty collection is ready", async () => {
  assert.deepEqual(await loadPosts({ endpoint, fetch: pages(response()) }), { state: "ready", posts: [] });
});

test("loads every cursor page and sends published-only core query", async () => {
  const calls = [];
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    assert.equal(init.method, "POST");
    assert.ok(init.signal);
    return calls.length === 1 ? response([post("one")], true, "cursor-1") : response([post("two")]);
  };
  const collection = await loadPosts({ endpoint, fetch, pageSize: 1 });
  assert.equal(collection.state, "ready");
  assert.deepEqual(collection.posts.map((item) => item.slug), ["one", "two"]);
  assert.deepEqual(calls.map((item) => item.variables), [{ first: 1, after: null }, { first: 1, after: "cursor-1" }]);
  assert.match(calls[0].query, /status: PUBLISH/);
  assert.match(calls[0].query, /isSticky/);
  assert.doesNotMatch(calls[0].query, /\bseo\b/);
});

test("each load fetches fresh data", async () => {
  const fetch = pages(response([post("one")]), response([post("two")]));
  assert.equal((await loadPosts({ endpoint, fetch })).posts[0].slug, "one");
  assert.equal((await loadPosts({ endpoint, fetch })).posts[0].slug, "two");
});

for (const cursor of [null, "", " ", 5]) {
  test(`rejects malformed next cursor ${JSON.stringify(cursor)}`, async () => {
    await assert.rejects(loadPosts({ endpoint, fetch: pages(response([post()], true, cursor)) }), /cursor|connection/);
  });
}

test("rejects repeated cursors and cycles", async () => {
  await assert.rejects(loadPosts({ endpoint, fetch: pages(
    response([post("one")], true, "a"), response([post("two")], true, "b"), response([post("three")], true, "a")
  ) }), /cursor/);
});

test("rejects empty advancing page, duplicate slugs and page exhaustion", async () => {
  await assert.rejects(loadPosts({ endpoint, fetch: pages(response([], true, "a")) }), /advance/);
  await assert.rejects(loadPosts({ endpoint, fetch: pages(response([post(), post()])) }), /duplicate/);
  await assert.rejects(loadPosts({ endpoint, maxPages: 1, fetch: pages(response([post()], true, "a")) }), /page limit/);
});

for (const [name, fetch, message] of [
  ["transport", async () => { throw new Error("socket down"); }, /transport/],
  ["HTTP", pages(new Response("unavailable", { status: 503 })), /503/],
  ["JSON", pages(new Response("not json")), /JSON/],
  ["GraphQL", pages(new Response(JSON.stringify({ data: { posts: {} }, errors: [{ message: "secret" }] }))), /GraphQL/],
  ["missing data", pages(new Response("{}")), /no data/],
  ["malformed connection", pages(new Response('{"data":{"posts":{"nodes":[]}}}')), /connection/]
]) {
  test(`configured ${name} failures reject instead of returning empty`, async () => {
    await assert.rejects(loadPosts({ endpoint, fetch }), message);
  });
}

test("request and total collection timeouts are bounded", async () => {
  for (const limits of [{ timeoutMs: 10 }, { collectionTimeoutMs: 10 }]) {
    let signal;
    await assert.rejects(loadPosts({ endpoint, ...limits, fetch: async (_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    } }), /timed out/);
    assert.equal(signal.aborted, true);
  }
});

test("invalid endpoints and limits reject before transport", async () => {
  const fetch = () => assert.fail("must not fetch");
  for (const url of ["bad", "file:///test", "https://user:password@example.test/graphql"]) {
    await assert.rejects(loadPosts({ endpoint: url, fetch }), /endpoint/);
  }
  for (const limits of [{ pageSize: 101 }, { maxPages: 0 }, { timeoutMs: -1 }, { collectionTimeoutMs: 0 }]) {
    await assert.rejects(loadPosts({ endpoint, fetch, ...limits }), /limits/);
  }
});

test("normalizes editorial fields, UTC dates, plain text, media and sanitized HTML", () => {
  const result = mapPost(post());
  assert.equal(result.title, "Hello & world");
  assert.equal(result.excerpt, "A useful article");
  assert.equal(result.content, "<p>Article <strong>body</strong></p>");
  assert.equal(result.publishedAt, "2026-01-02T03:04:05.000Z");
  assert.equal(result.updatedAt, "2026-02-03T04:05:06.000Z");
  assert.equal(result.author.name, "Author & team");
  assert.equal(result.categories[0].slug, "gestion-empresarial");
  assert.equal(result.cover.width, 800);
  assert.equal(result.featured, true);
  assert.equal(result.seo, undefined);
});

test("published nullable titles load with an honest fallback", async () => {
  const result = await loadPosts({ endpoint, fetch: pages(response([post("untitled", { title: null })])) });
  assert.equal(result.state, "ready");
  assert.equal(result.posts[0].title, "Artículo sin título");
  assert.throws(() => mapPost(post("draft", { title: null, status: "draft" })), /unpublished/);
});

test("empty titles after plain-text cleaning use the fallback", () => {
  for (const title of ["", " \t\n ", "<em></em><br>", "<p> &nbsp; </p>", "<script>bad()</script>"]) {
    assert.equal(mapPost(post("untitled", { title })).title, "Artículo sin título");
  }
});

test("nonempty titles remain sanitized plain text with decoded entities", () => {
  for (const [title, expected] of [
    ["  Control de plagas  ", "Control de plagas"],
    ["<em>Calidad</em> &amp; seguridad", "Calidad & seguridad"],
    ["<script>bad()</script>A &lt; B &#233;", "A < B é"]
  ]) {
    assert.equal(mapPost(post("titled", { title })).title, expected);
  }
});

test("missing and non-string/non-null titles remain invalid", () => {
  for (const title of [undefined, 42, {}, [], false]) {
    assert.throws(() => mapPost(post("invalid", { title })), /invalid/);
  }
  const missingTitle = post();
  delete missingTitle.title;
  assert.throws(() => mapPost(missingTitle), /invalid/);
});

test("nullable editorial content is supported but malformed/draft data rejects", () => {
  const result = mapPost(post("minimal", {
    author: null, featuredImage: null, content: null, excerpt: null,
    dateGmt: null, modifiedGmt: null, isSticky: false,
    categories: { nodes: [], pageInfo: { hasNextPage: false } }
  }));
  assert.equal(result.content, "");
  assert.equal(result.cover, undefined);
  assert.equal(result.author, undefined);
  assert.equal(result.featured, false);
  for (const override of [{ status: "draft" }, { slug: "" }, { content: {} }, { author: {} },
    { featuredImage: {} }, { dateGmt: "invalid" }, { isSticky: null },
    { categories: { nodes: [], pageInfo: { hasNextPage: true } } }]) {
    assert.throws(() => mapPost(post("bad", override)), /WordPress/);
  }
});

test("sanitization removes executable markup, event handlers and unsafe URLs", () => {
  const html = sanitizeContent(`<script>alert(1)</script><style>body{display:none}</style>
    <iframe src="https://evil.test"></iframe><svg onload="alert(1)"></svg>
    <form action="/submit"><input autofocus onfocus="alert(1)"></form>
    <p onclick="alert(1)" style="color:red">Safe</p>
    <a href="jav&#x61;script:alert(1)" target="_blank">Bad</a>
    <a href="//evil.test">Protocol relative</a><a href="/blog/safe">Local</a>
    <img src="data:image/svg+xml,evil" onerror="alert(1)">
    <img src="https://cms.example.test/good.jpg" alt="Good">`);
  assert.doesNotMatch(html, /script|style|iframe|svg|form|input|onclick|onerror|onload|data:|target=|href="\/\//i);
  assert.match(html, /<p>Safe<\/p>/);
  assert.match(html, /href="\/blog\/safe"/);
  assert.match(html, /src="https:\/\/cms.example.test\/good.jpg"/);
  assert.equal(plainText("<script>bad()</script>A &amp; B &lt; C"), "A & B < C");
  for (const url of ["javascript:alert(1)", "data:image/png;base64,abc", "//evil.test", "/relative", "https://a:b@evil.test"]) {
    assert.equal(safeUrl(url), undefined);
    assert.equal(mapPost(post("unsafe", { featuredImage: { node: { sourceUrl: url, altText: "", mediaDetails: null } } })).cover, undefined);
  }
});
