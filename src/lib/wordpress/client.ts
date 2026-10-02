export interface WordPressClientOptions {
  endpoint?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface GraphQLRequestOptions<TVariables> extends WordPressClientOptions {
  query: string;
  variables?: TVariables;
  previewToken?: string;
}

export function wordpressEndpoint(): string | undefined {
  return import.meta.env?.WORDPRESS_GRAPHQL_ENDPOINT?.trim() || undefined;
}

export async function wordpressRequest<TData, TVariables = Record<string, never>>(
  options: GraphQLRequestOptions<TVariables>
): Promise<TData> {
  const endpoint = options.endpoint ?? wordpressEndpoint();
  if (!endpoint) throw new Error("WORDPRESS_GRAPHQL_ENDPOINT is not configured.");
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("WordPress endpoint must be an absolute HTTP(S) URL.");
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("WordPress endpoint must be an HTTP(S) URL without credentials.");
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid WordPress timeout.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("WordPress request timed out."));
    }, timeoutMs);
  });
  try {
    // Race also bounds injected transports that do not implement AbortSignal.
    return await Promise.race([
      (async () => {
        const response = await (options.fetch ?? fetch)(url.href, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            ...(options.previewToken ? { authorization: `Bearer ${options.previewToken}` } : {})
          },
          body: JSON.stringify({ query: options.query, variables: options.variables })
        });
        if (!response.ok) throw new Error(`WordPress request failed with status ${response.status}.`);
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") throw new Error("Invalid WordPress response.");
        const result = payload as { data?: TData; errors?: unknown };
        if (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length)) {
          // Do not echo server messages that might disclose credentials or internal paths.
          throw new Error("WordPress GraphQL returned errors; verify WPGraphQL schema and query permissions.");
        }
        if (!result.data || typeof result.data !== "object") throw new Error("WordPress request returned no data.");
        return result.data;
      })(),
      timeout
    ]);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("WordPress request timed out.");
    if (error instanceof Error && error.message.startsWith("WordPress")) throw error;
    throw new Error("WordPress transport or JSON response failed.");
  } finally {
    clearTimeout(timer);
  }
}
