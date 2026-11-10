import { vi } from "vitest";

export interface StubCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  credentials: RequestCredentials | undefined;
  referrerPolicy: ReferrerPolicy | undefined;
}

type Reply = { status: number; body: unknown } | "network-error";

/**
 * A stand-in for the API in unit tests. Health is always fine. /api/me answers signed in or
 * signed out as set, and so does a log pull (an empty log). Other answers come from `replies`,
 * by "METHOD path".
 */
export function stubApi(
  options: { signedIn?: boolean; phones?: number; replies?: Record<string, Reply[]> } = {},
) {
  const calls: StubCall[] = [];
  const replies = new Map(Object.entries(options.replies ?? {}));
  let signedIn = options.signedIn ?? false;
  const fetchStub = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init.method ?? "GET";
    const headers = new Map(Object.entries((init.headers ?? {}) as Record<string, string>));
    calls.push({
      url,
      method,
      headers: Object.fromEntries(headers),
      body: typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
      credentials: init.credentials,
      referrerPolicy: init.referrerPolicy,
    });
    const queued = replies.get(`${method} ${url}`);
    const next = queued?.shift();
    if (next === "network-error") return Promise.reject(new TypeError("Failed to fetch"));
    if (next) {
      if (url === "/api/auth/sign-in/finish" || url === "/api/auth/sign-up/finish") {
        signedIn = next.status < 300;
      }
      return Promise.resolve(Response.json(next.body, { status: next.status }));
    }
    if (url === "/api/health") return Promise.resolve(Response.json({ ok: true }));
    if (url === "/api/me" && method === "GET") {
      return Promise.resolve(
        signedIn
          ? Response.json({ signedIn: true, phonesSignedIn: options.phones ?? 1 })
          : Response.json(
              { error: { code: "unauthorized", message: "Please sign in." } },
              { status: 401 },
            ),
      );
    }
    if (url.startsWith("/api/logs?") && method === "GET") {
      return Promise.resolve(
        signedIn
          ? Response.json({ entries: [], latestRev: 0, more: false })
          : Response.json(
              { error: { code: "unauthorized", message: "Please sign in." } },
              { status: 401 },
            ),
      );
    }
    return Promise.resolve(
      Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 }),
    );
  });
  vi.stubGlobal("fetch", fetchStub);
  return { calls, setSignedIn: (v: boolean) => (signedIn = v) };
}

export function apiError(code: string, status: number): Reply {
  return { status, body: { error: { code, message: "fixed message" } } };
}
