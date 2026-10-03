export interface WordPressPost {
  slug: string;
  status: "publish";
  title: string | null;
  excerpt: string | null;
  content: string | null;
  dateGmt: string | null;
  modifiedGmt: string | null;
  isSticky: boolean;
  author: { node: { name: string; slug: string } | null } | null;
  categories: { nodes: Array<{ name: string; slug: string }>; pageInfo: { hasNextPage: boolean } };
  tags: { nodes: Array<{ name: string; slug: string }>; pageInfo: { hasNextPage: boolean } };
  featuredImage: {
    node: {
      sourceUrl: string | null;
      altText: string | null;
      mediaDetails: { width: number | null; height: number | null } | null;
    } | null;
  } | null;
}

export interface PostsPage {
  posts: {
    nodes: WordPressPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}
