# Blog frontend

## Build-time content

The static Astro routes `/blog` and `/blog/[slug]` load published posts through WPGraphQL at build time. Set `WORDPRESS_GRAPHQL_ENDPOINT` in the build environment to the public endpoint `https://cms.maiaconsultoresperu.com/graphql`. Public blog loading does not require credentials.

An absent or blank endpoint produces an honest unconfigured listing with no article routes. A configured endpoint that fails, returns invalid data, or cannot provide the complete collection fails the build instead of silently publishing a partial blog. A valid empty collection displays a separate empty state.

WordPress responses are normalized into internal `Post` models before reaching presentation components. Rich text is sanitized with an explicit HTML allowlist; media URLs are validated. Routes compose the listing/article features rather than passing raw GraphQL objects into UI components.

Production canonical URLs use `https://www.maiaconsultoresperu.com` through `src/lib/config/site.ts` and the shared SEO resolver.

## Local checks

Use Node.js 24.11 or newer for compatibility with the exact TypeScript-stripping test command. The root package currently declares no Node engine; the installed `sanitize-html` 2.17.7 package requires Node >=22.12.0. Confirm the production build runtime separately.

```sh
npm run test:blog
npm run typecheck
npm run build
```

The test script runs both data/sanitization and listing-model regression tests. When preserving a dirty working tree, run these checks against an isolated export of the selected candidate, not the original checkout: Astro generates metadata and caches. Build output can be redirected with `npm run build -- --outDir <owned-temporary-output>`.

Previous verification reported four baseline TS2352 errors in the license FAQ (lines 87/94) and SaaS FAQ (lines 92/99). Those unrelated errors are not fixed by this frontend delivery. Historical passes are not proof that the current selected candidate passed; rerun checks and record their actual results.

## Publication boundary

Content is a build-time snapshot, not an instant live feed. A configured WordPress publish/update hook requests a later Cloudflare Pages rebuild; content changes become public only after that build and deployment succeed. The WordPress integration plugin is installed separately and is not included in these frontend commits.

The owner must confirm the Pages build endpoint, Node runtime, production branch/domain, successful deployment, and WordPress hook/cron operation. This guide does not establish production deployment or native review approval.

Keep delivery in two coherent units: (1) published-data loading, normalization/sanitization, dependencies, both regression test files and their listing model; (2) listing/article routes, UI, assets, blog-only shared-component changes, canonical origin and this guide. Preserve unrelated working-tree changes outside those units.
