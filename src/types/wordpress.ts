export interface WordPressConnection<TNode> {
  nodes: TNode[];
}

export interface WordPressSEOFields {
  title?: string | null;
  metaDesc?: string | null;
  canonical?: string | null;
  opengraphImage?: {
    sourceUrl?: string | null;
  } | null;
}
