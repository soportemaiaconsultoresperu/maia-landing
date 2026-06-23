export const pageBySlugQuery = /* GraphQL */ `
  query PageBySlug($slug: ID!) {
    page(id: $slug, idType: URI) {
      title
      slug
      content
      seo {
        title
        metaDesc
        canonical
      }
    }
  }
`;
