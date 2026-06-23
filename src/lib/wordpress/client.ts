interface GraphQLRequestOptions<TVariables> {
  query: string;
  variables?: TVariables;
  previewToken?: string;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: Array<{ message: string }>;
}

const endpoint = import.meta.env.WORDPRESS_GRAPHQL_ENDPOINT;

export async function wordpressRequest<TData, TVariables = Record<string, never>>(
  options: GraphQLRequestOptions<TVariables>
): Promise<TData> {
  if (!endpoint) {
    throw new Error("WORDPRESS_GRAPHQL_ENDPOINT is not configured.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.previewToken ? { authorization: `Bearer ${options.previewToken}` } : {})
    },
    body: JSON.stringify({
      query: options.query,
      variables: options.variables
    })
  });

  if (!response.ok) {
    throw new Error(`WordPress request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("WordPress request returned no data.");
  }

  return payload.data;
}
