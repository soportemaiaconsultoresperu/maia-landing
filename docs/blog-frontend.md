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

The test script runs data/sanitization, listing-model and DOM-contract controller regressions. The controller tests use a small DOM double and source-wiring assertions; they are not compiled Astro or live asset-delivery proof. When preserving a dirty working tree, run these checks against an isolated export of the selected candidate, not the original checkout: Astro generates metadata and caches. Build output can be redirected with `npm run build -- --outDir <owned-temporary-output>`.

Previous verification reported four baseline TS2352 errors in the license FAQ (lines 87/94) and SaaS FAQ (lines 92/99). Those unrelated errors are not fixed by this frontend delivery. Historical passes are not proof that the current selected candidate passed; rerun checks and record their actual results.

## Filtros del listado

Los temas y la búsqueda se combinan en la misma página, sin rutas de categorías. El destacado se elige del conjunto coincidente: primero el artículo marcado más reciente, o el más reciente si ninguno está marcado. Se oculta si no hay coincidencias. «Todo» elimina el filtro de tema, pero conserva la búsqueda; cambiar tema o búsqueda reinicia la paginación. El contador corresponde al listado (el destacado puede repetir uno de esos artículos). «Recientes de todos los temas» permanece global.

El control de tema seleccionado (incluido «Todo») tiene relleno verde claro, borde marcado y una marca de verificación decorativa; no se resaltan las tarjetas de artículos. El selector local `.topic-grid button[aria-pressed="true"]` prevalece sobre el estilo base. El foco de teclado mantiene un contorno azul independiente de la selección. Los tests cubren la exclusividad al cambiar tema, buscar y paginar, y el contrato de estilos; la apariencia compilada y el contraste requieren revisión en navegador.

Las categorías adicionales conservan su nombre y clave exactos y usan una tarjeta de la misma grilla responsive, con un icono de etiqueta SVG decorativo local. Los temas fijos conservan sus PNG originales; no se requieren campos de WordPress, imágenes remotas ni alias nuevos.

Sin JavaScript se muestran el destacado inicial y todos los artículos; los controles deshabilitados y el aviso explican que la búsqueda necesita JavaScript. El controlador conserva botones nativos, `aria-pressed`, foco visible y contador anunciado. Las tarjetas destacadas alternativas se renderizan dentro de `template`: sus imágenes permanecen inertes hasta seleccionar la tarjeta y además conservan `loading="lazy"`. Esto aumenta el HTML del listado, pero evita descargar todas las imágenes candidatas de forma anticipada y reutiliza el componente normalizado `PostCard`. Una sola inicialización por raíz evita listeners duplicados.

La aceptación humana sigue pendiente: probar tema fijo/adicional/vacío, búsqueda combinada y «Todo», «Ver más», navegación por teclado y la grilla en móvil. Los tests de contrato no reemplazan esa revisión ni demuestran una falla de entrega de JavaScript del sitio publicado.

## Article tags and edited media

The core WPGraphQL query requests `tags(first: 100)` with connection completeness. Missing, malformed or truncated tag connections fail loading instead of publishing incomplete chips. Normalized tags are plain names/slugs, independent of categories. The article renders an escaped, non-linked list under **Etiquetas** and omits it when empty; no tag routes, search or custom CMS fields are introduced.

Body media remains inside the existing 70ch reading column; the cover is unchanged. Only recognized WordPress image/video/embed and alignment/aspect classes survive. Edited width accepts finite positive pixel values up to 10,000 or percentages up to 100; aspect ratios are bounded positive numbers or pairs. Fixed CSS heights are discarded in favor of proportional `height:auto`, and `max-width:100%` clamps media on small screens. Other CSS, events and arbitrary classes are removed. Left/right/center alignment uses block margins, not floating text or full-bleed expansion. Images without edited widths are not automatically enlarged. The verified 205×129 original can render at the editor's 645px width but cannot gain image detail.

Iframe admission is deliberately narrow: literal HTTPS `www.youtube.com/embed/<11-character-video-id>` URLs, optionally with `?feature=oembed` (removed on output). Other hosts, paths, query parameters, fragments, explicit ports, credentials, encoded aliases and `srcdoc` are rejected. Title/loading/referrer policy and permissions are rebuilt; fullscreen and picture-in-picture remain available, but incoming autoplay or arbitrary permissions do not. Recognized WP aspect classes control embed proportions; otherwise valid iframe dimensions determine the ratio, with a 16:9 fallback only for iframes lacking geometry.

Native video retains safe absolute HTTP(S) source/poster URLs, bounded dimensions and validated sizing, with controls, metadata preload and no autoplay. Source MIME types, when supplied, must be `video/mp4`, `video/webm` or `video/ogg`. Native video is not forced to 16:9. Script, SVG, forms, unsafe URLs and executable attributes remain prohibited.

Regressions cover the supplied post48 markup, taxonomy completeness, provider URL attacks, hostile sizing and native video. These fixtures are not a live GraphQL fetch or playback test. Browser geometry/alignment, mobile clamping, captions, fullscreen/audio, third-party embed accessibility/privacy and human acceptance still require independent checks; unsupported providers are not silently admitted.

## Publication boundary

Content is a build-time snapshot, not an instant live feed. A configured WordPress publish/update hook requests a later Cloudflare Pages rebuild; content changes become public only after that build and deployment succeed. The WordPress integration plugin is installed separately and is not included in these frontend commits.

The owner must confirm the Pages build endpoint, Node runtime, production branch/domain, successful deployment, and WordPress hook/cron operation. This guide does not establish production deployment or native review approval.

Keep delivery in two coherent units: (1) published-data loading, normalization/sanitization, dependencies, both regression test files and their listing model; (2) listing/article routes, UI, assets, blog-only shared-component changes, canonical origin and this guide. Preserve unrelated working-tree changes outside those units.
