# AGENTS.md

This file is the operating guide for automated agents and contributors working on this project.

## Stack

- Astro
- Tailwind CSS
- TypeScript
- Headless WordPress
- WPGraphQL

## Architecture Principles

- Keep routes thin: pages load data, choose layouts, and compose feature sections.
- Normalize WordPress data before it reaches UI components.
- Do not pass raw WPGraphQL objects into presentation components.
- Keep UI primitives independent from CMS, routing, and fetching.
- Prefer clear domain modules over global abstractions.
- Add shared abstractions only when they remove real duplication or match an existing pattern.

## Folder Responsibilities

- `src/pages/`: route entrypoints only.
- `src/layouts/`: document shells and page-level layout contracts.
- `src/features/`: page and domain sections such as home, projects, blog, and CMS pages.
- `src/components/ui/`: CMS-agnostic design primitives.
- `src/components/website/`: website principal shared components such as the main header.
- `src/components/wordpress/`: WordPress content renderers such as rich text, blocks, media, and embeds.
- `src/components/seo/`: Astro components that render SEO tags and structured data.
- `src/lib/wordpress/`: WPGraphQL client, queries, mappers, generated types, and preview helpers.
- `src/lib/seo/`: metadata resolution, schema helpers, sitemap helpers, and robots policy.
- `src/lib/config/`: site-wide constants and environment-aware settings.
- `src/styles/`: Tailwind entry CSS and project design tokens.
- `src/types/`: stable internal contracts consumed by the frontend.
- `src/utils/`: small framework-agnostic utilities.

## Editing Rules

- Do not fetch data inside UI primitives.
- Do not mix WordPress transport logic with Astro components.
- Do not expose WordPress field names as component APIs unless the component is explicitly WordPress-specific.
- Do not create broad utility modules for one-off behavior.
- Keep route-specific composition in `features/`, not in `components/ui/`.
- Keep SEO fallbacks centralized in `src/lib/seo/metadata.ts`.
- Keep route path generation centralized in `src/lib/routes/paths.ts`.

## Component Strategy

- UI primitives: small reusable components with no editorial logic.
- Domain components: project, post, author, category, and related-content components.
- Page sections: composed blocks used by pages and feature modules.
- Layouts: `WebsiteLayout`, `ProjectLayout`, and `ArticleLayout` wrap pages by intent.

## SEO Strategy

- Use the internal `SEO` contract as the source of truth for rendered metadata.
- Resolve SEO in this order: WordPress manual SEO, editorial fields, site defaults.
- Generate canonical URLs, Open Graph, Twitter cards, JSON-LD, sitemap data, and robots policy.
- Keep JSON-LD generation in `src/lib/seo/schema.ts`.

## WordPress Strategy

- WPGraphQL is the primary content API.
- Use view-specific GraphQL queries instead of large generic queries.
- Keep query documents in `src/lib/wordpress/queries/`.
- Map WPGraphQL responses to internal models in `src/lib/wordpress/mappers/`.
- Support draft preview through secure preview helpers in `src/lib/wordpress/preview.ts`.
- Prefer static generation for website pages, projects, and blog posts.
- Use WordPress webhooks for rebuilds unless the hosting platform supports on-demand revalidation.

## Commands

- `npm run dev`: start local development.
- `npm run build`: build the Astro site.
- `npm run preview`: preview the production build.
- `npm run typecheck`: run Astro and TypeScript checks.

## Delivery Checklist

- Run `npm run typecheck` when TypeScript or Astro files change.
- Run `npm run build` before delivery when routes, data, or layouts change.
- Do a visual review when UI, layout, responsive behavior, or content rendering changes.
- Document any command that could not be run.
