export function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) =>
        headers.set(key, value),
      );
    }

    if (
      apiKey.startsWith("sb_") &&
      headers.get("Authorization") === `Bearer ${apiKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}
