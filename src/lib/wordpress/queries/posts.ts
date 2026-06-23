export const postsIndexQuery = /* GraphQL */ `
  query PostsIndex {
    posts {
      nodes {
        title
        slug
        excerpt
        date
      }
    }
  }
`;

export const postBySlugQuery = /* GraphQL */ `
  query PostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      title
      slug
      excerpt
      content
      date
      modified
    }
  }
`;
