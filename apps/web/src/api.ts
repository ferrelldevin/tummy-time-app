import { API_REQUEST_HEADER, API_REQUEST_HEADER_VALUE, apiErrorSchema } from "@tummy/shared";
import type { ApiErrorCode } from "@tummy/shared";

export type ApiFailure = ApiErrorCode | "network" | "unexpected";
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

/** Anything with Zod's safeParse, such as the shared response schemas. */
export interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/**
 * Calls our own API. The session cookie is HttpOnly, so this code never sees it: the browser
 * sends it. Nothing about the account is stored on the phone by this code.
 *
 * Every call carries the custom header the API requires on state-changing requests. The
 * referrer policy is set on the request so the browser always sends our Origin with it: the
 * page itself is served with "no-referrer", which on some browsers would make Origin "null".
 */
export async function apiCall<T>(
  path: string,
  schema: Parser<T>,
  options: { method?: "GET" | "POST" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { [API_REQUEST_HEADER]: API_REQUEST_HEADER_VALUE };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
      referrerPolicy: "same-origin",
      cache: "no-store",
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: "unexpected" };
  }
  if (response.ok) {
    const parsed = schema.safeParse(json);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "unexpected" };
  }
  const failure = apiErrorSchema.safeParse(json);
  return { ok: false, error: failure.success ? failure.data.error.code : "unexpected" };
}
