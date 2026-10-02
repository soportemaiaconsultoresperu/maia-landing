/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly WORDPRESS_GRAPHQL_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
