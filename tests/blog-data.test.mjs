import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  tags: { nodes: [], pageInfo: { hasNextPage: false } },
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
  assert.match(calls[0].query, /tags\(first: 100\)\s*\{\s*nodes \{ name slug \}\s*pageInfo \{ hasNextPage \}/);
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

const tags = (nodes, hasNextPage = false) => ({ nodes, pageInfo: { hasNextPage } });
test("core tags normalize to plain chips without changing category meaning", () => {
  assert.deepEqual(mapPost(post()).tags, []);
  assert.equal(mapPost(post("limit", { tags: tags(Array.from({ length: 100 }, (_, index) => ({
    name: `Tag ${index}`, slug: `tag-${index}`
  }))) })).tags.length, 100);
  const result = mapPost(post("tagged", { tags: tags([
    { name: "peru", slug: "peru" }, { name: "saneamiento", slug: "saneamiento" },
    { name: "<em>A</em> &amp; &lt;img src=x onerror=bad()&gt;", slug: "literal" }
  ]) }));
  assert.deepEqual(result.tags, [
    { name: "peru", slug: "peru" }, { name: "saneamiento", slug: "saneamiento" },
    { name: "A & <img src=x onerror=bad()>", slug: "literal" }
  ]);
  assert.deepEqual(result.categories, mapPost(post()).categories);
});

for (const [name, value] of [
  ["missing", undefined], ["null", null], ["missing nodes", {}], ["wrong nodes", tags({})],
  ["truncated", tags([], true)], ["missing completeness", { nodes: [] }],
  ["malformed completeness", tags([], "false")], ["null node", tags([null])],
  ["numeric name", tags([{ name: 1, slug: "tag" }])], ["empty name", tags([{ name: "<em></em>", slug: "tag" }])],
  ["missing slug", tags([{ name: "Tag" }])], ["blank slug", tags([{ name: "Tag", slug: " " }])],
  ["over limit", tags(Array.from({ length: 101 }, () => ({ name: "Tag", slug: "tag" })))]
]) {
  test(`invalid tag connection (${name}) fails the collection rather than silently dropping tags`, async () => {
    await assert.rejects(loadPosts({ endpoint, fetch: pages(response([post("bad-tags", { tags: value })])) }), /tags/);
  });
}

const realImage = `<figure class="wp-block-image size-full is-resized"><img loading="lazy" decoding="async" width="205" height="129" src="https://cms.maiaconsultoresperu.com/wp-content/uploads/2026/06/Captura-de-pantalla-2026-09-15-193219-1.png" alt="" class="wp-image-39" style="aspect-ratio:1.5891878923587508;width:645px;height:auto"/></figure>`;
const embedUrl = "https://www.youtube.com/embed/bQFzqcfY-XI";
const realEmbed = `<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper"><iframe loading="lazy" title="Maia Plagas | Gestiona tu empresa de Saneamiento Ambiental en un solo lugar" width="500" height="281" src="${embedUrl}?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></figure>`;

test("post48 preserves edited image geometry and the verified YouTube embed through normalization", () => {
  const result = mapPost(post("saneamiento-ambiental-en-el-peru-desafios-y-oportunidades-para-proteger-la-salud-y-el-ambiente", {
    tags: tags([{ name: "peru", slug: "peru" }, { name: "saneamiento", slug: "saneamiento" }]),
    content: realImage + realEmbed
  }));
  assert.match(result.content, /class="wp-block-image size-full is-resized"/);
  assert.match(result.content, /width="205" height="129"/);
  assert.match(result.content, /aspect-ratio:1\.5891878923587508;width:645px;height:auto/);
  assert.match(result.content, /wp-embed-aspect-16-9 wp-has-aspect-ratio/);
  assert.match(result.content, /class="wp-block-embed__wrapper"/);
  assert.ok(result.content.includes(`src="${embedUrl}"`));
  assert.match(result.content, /title="Maia Plagas \| Gestiona/);
  assert.match(result.content, /aspect-ratio:500 \/ 281/);
  assert.match(result.content, /allow="encrypted-media; picture-in-picture; fullscreen"/);
  assert.match(result.content, /allowfullscreen/);
  assert.match(result.content, /loading="lazy"/);
  assert.match(result.content, /referrerpolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(result.content, /autoplay|clipboard-write|frameborder|wp-image-39|decoding=/);
});

test("iframe admission rejects host, path, credential, port and encoding aliases", () => {
  for (const src of [
    "http://www.youtube.com/embed/bQFzqcfY-XI", "//www.youtube.com/embed/bQFzqcfY-XI",
    "https://youtube.com/embed/bQFzqcfY-XI", "https://www.youtube.com.evil.test/embed/bQFzqcfY-XI",
    "https://www.youtube.com@evil.test/embed/bQFzqcfY-XI", "https://user@www.youtube.com/embed/bQFzqcfY-XI",
    "https://www.youtube.com:443/embed/bQFzqcfY-XI", "https://www.youtube.com:444/embed/bQFzqcfY-XI",
    "https://www.youtube.com/watch?v=bQFzqcfY-XI", "https://www.youtube.com/redirect?q=https://evil.test",
    "https://www.youtube.com/embed/../embed/bQFzqcfY-XI", "https://www.youtube.com/%65mbed/bQFzqcfY-XI",
    "https://www.youtube.com/embed%2FbQFzqcfY-XI", "https://www.youtube.com/embed/bQFzqcfY%2DXI",
    `${embedUrl}?autoplay=1`, `${embedUrl}#fragment`, `${embedUrl}?feature=oembed&url=https://evil.test`,
    "https://www.youtube.com\\@evil.test/embed/bQFzqcfY-XI", `${embedUrl}\n`,
    "javascript:alert(1)", "data:text/html,bad", "/embed/bQFzqcfY-XI"
  ]) {
    assert.doesNotMatch(sanitizeContent(`<iframe src="${src}"></iframe>`), /<iframe/, src);
  }
  assert.doesNotMatch(sanitizeContent(`<iframe src="${embedUrl}" srcdoc="bad"></iframe>`), /<iframe/);
  const safe = sanitizeContent(`<iframe src="${embedUrl}" onload="bad()" style="position:fixed" allow="autoplay" title="&lt;script&gt;bad()&lt;/script&gt;"></iframe>`);
  assert.match(safe, /title="Video de YouTube"/);
  assert.doesNotMatch(safe, /onload|position|autoplay|script/);
  const badGeometry = sanitizeContent(`<iframe src="${embedUrl}" width="Infinity" height="-1" style="aspect-ratio:0"></iframe>`);
  assert.doesNotMatch(badGeometry, /width=|height=|style=/);
});

test("only recognized media classes, sizing and captions survive hostile styles", () => {
  const html = sanitizeContent(`<figure class="wp-block-image alignright rogue" style="width:80%;height:999px;position:fixed">
    <img class="alignleft rogue" src="https://cms.example.test/a.png" style="width:645px;height:22px;aspect-ratio:4/3;background:url(https://evil.test);transform:rotate(20deg)" onerror="bad()">
    <figcaption onclick="bad()">Caption <em>retained</em></figcaption></figure>`);
  assert.match(html, /class="wp-block-image alignright" style="width:80%;height:auto"/);
  assert.match(html, /class="alignleft"/);
  assert.match(html, /width:645px;aspect-ratio:4 \/ 3;height:auto/);
  assert.match(html, /<figcaption>Caption <em>retained<\/em><\/figcaption>/);
  assert.doesNotMatch(html, /rogue|999|22px|position|background|transform|onerror|onclick|evil/);
  for (const size of ["0", "-1", "Infinity", "NaN", "1e3", "10001", "1px", "calc(1px)"]) {
    const unsafe = sanitizeContent(`<img src="https://cms.example.test/a.png" width="${size}" height="${size}" style="width:${size}px;aspect-ratio:${size};height:${size}px">`);
    assert.doesNotMatch(unsafe, /width=|height=|style=/, size);
  }
  for (const style of ["width:101%", "width:expression(bad())", "width:1px!important", "width:var(--x)",
    "aspect-ratio:1/0", "aspect-ratio:Infinity", "aspect-ratio:10000/.0000001", "width:645px/**/", "position:fixed"]) {
    assert.doesNotMatch(sanitizeContent(`<img style="${style}">`), /style=/, style);
  }
});

test("native video keeps safe sources and its own dimensions with controls but never autoplay", () => {
  const html = sanitizeContent(`<figure class="wp-block-video aligncenter"><video width="480" height="640" poster="https://cms.example.test/poster.png" autoplay loop muted onplay="bad()" style="width:480px;height:640px;aspect-ratio:3/4">
    <source src="https://cms.example.test/movie.mp4" type="video/mp4">
    <source src="http://cms.example.test/movie.webm" type="video/webm">Video no disponible.</video></figure>`);
  assert.match(html, /width="480" height="640"/);
  assert.match(html, /aspect-ratio:3 \/ 4;height:auto/);
  assert.match(html, /controls(?:="")? preload="metadata" playsinline(?:="")?/);
  assert.match(html, /poster="https:\/\/cms.example.test\/poster.png"/);
  assert.match(html, /type="video\/mp4"/);
  assert.match(html, /type="video\/webm"/);
  assert.doesNotMatch(html, /autoplay|loop|muted|onplay|640px/);
  for (const src of ["javascript:bad()", "data:video/mp4,bad", "//evil.test/a.mp4", "/local.mp4", "https://user:pass@evil.test/a.mp4"]) {
    const unsafe = sanitizeContent(`<video src="${src}" poster="${src}"><source src="${src}" type="video/mp4"></video>`);
    assert.doesNotMatch(unsafe, /<source|javascript:|data:|evil|local/);
  }
  assert.doesNotMatch(sanitizeContent('<video><source src="https://cms.example.test/a" type="text/html"></video>'), /<source/);
  assert.match(sanitizeContent('<video src="https://cms.example.test/a.mp4"></video>'), /src="https:\/\/cms.example.test\/a.mp4"/);
});

test("article chips are escaped non-links and media CSS clamps geometry without forcing native video ratios", () => {
  const article = readFileSync(new URL("../src/features/blog/BlogArticle.astro", import.meta.url), "utf8");
  const section = article.slice(article.indexOf('{(post.tags?.length'), article.indexOf('    <a', article.indexOf('{(post.tags?.length')));
  assert.match(section, /post\.tags\?\.length \?\? 0\) > 0/);
  assert.match(section, />Etiquetas<\/h2>/);
  assert.match(section, /<li>\{tag\.name\}<\/li>/);
  assert.doesNotMatch(section, /set:html|href=/);
  const renderer = readFileSync(new URL("../src/components/wordpress/PostContent.astro", import.meta.url), "utf8");
  assert.match(renderer, /max-width: 70ch/);
  const imageRule = renderer.match(/:global\(img\) \{([^}]+)\}/)[1];
  const videoRule = renderer.match(/:global\(video\) \{([^}]+)\}/)[1];
  for (const rule of [imageRule, videoRule]) {
    assert.match(rule, /max-width: 100%; height: auto/);
    assert.doesNotMatch(rule, /(?:^|;)\s*width: 100%|aspect-ratio/);
  }
  assert.match(renderer, /\.alignright img/);
  assert.match(renderer, /\.alignleft video/);
  assert.match(renderer, /wp-embed-aspect-4-3 iframe\) \{ aspect-ratio: 4 \/ 3 !important/);
});
