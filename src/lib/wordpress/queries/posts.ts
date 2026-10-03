// Core WPGraphQL fields only; no SEO or custom-field plugin is required.
export const postsIndexQuery = /* GraphQL */ `
  query PublishedPosts($first: Int!, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        slug
        status
        title
        excerpt
        content
        dateGmt
        modifiedGmt
        isSticky
        author { node { name slug } }
        categories(first: 100) {
          nodes { name slug }
          pageInfo { hasNextPage }
        }
        tags(first: 100) {
          nodes { name slug }
          pageInfo { hasNextPage }
        }
        featuredImage { node { sourceUrl altText mediaDetails { width height } } }
      }
    }
  }
`;
