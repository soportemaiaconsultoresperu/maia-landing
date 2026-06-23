export const projectsIndexQuery = /* GraphQL */ `
  query ProjectsIndex {
    projects {
      nodes {
        title
        slug
        excerpt
      }
    }
  }
`;

export const projectBySlugQuery = /* GraphQL */ `
  query ProjectBySlug($slug: ID!) {
    project(id: $slug, idType: SLUG) {
      title
      slug
      excerpt
      content
    }
  }
`;
