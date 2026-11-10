import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAMILY_CODE_ALPHABET, isWellFormedFamilyCode } from "@tummy/shared";
import { loadAuthSettings } from "../../src/auth/config.js";
import { DevFakeRefused, devFakeProvider } from "../../src/auth/dev-fake.js";
import { codeLookup, generateFamilyCode } from "../../src/auth/family-code.js";
import { isCommonPin } from "../../src/auth/pin-rules.js";
import { SAME_SITE } from "../same-site.js";
import { authTestApp, me, sessionToken, signUp, type AuthTestApp } from "./helpers.js";

const goodSecret = randomBytes(32).toString("base64");
const base = { CODE_LOOKUP_SECRET: goodSecret, APP_ORIGIN: "https://tummytime.example.org" };

describe("family codes", () => {
  it("are 12 characters from the look-alike-free alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateFamilyCode();
      expect(code).toHaveLength(12);
      expect(isWellFormedFamilyCode(code)).toBe(true);
    }
  });

  it("use every character about equally often (no bias toward the start of the alphabet)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < FAMILY_CODE_ALPHABET.length; i += 1) {
      counts.set(FAMILY_CODE_ALPHABET.charAt(i), 0);
    }
    const codes = 2000;
    for (let i = 0; i < codes; i += 1) {
      const code = generateFamilyCode();
      for (let j = 0; j < code.length; j += 1) {
        const c = code.charAt(j);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const expected = (codes * 12) / FAMILY_CODE_ALPHABET.length; // about 774
    for (const [c, n] of counts) {
      // About 7 standard deviations either side: a real bias would show, chance will not.
      expect(n, c).toBeGreaterThan(expected * 0.75);
      expect(n, c).toBeLessThan(expected * 1.25);
    }
  });

  it("are looked up by a keyed hash: 64 lowercase hex, and a different secret gives a different value", () => {
    const code = generateFamilyCode();
    const a = codeLookup(randomBytes(32), code);
    const b = codeLookup(randomBytes(32), code);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    const key = randomBytes(32);
    expect(codeLookup(key, code)).toBe(codeLookup(key, code));
  });
});

describe("common PINs are refused", () => {
  it.each([
    "000000",
    "111111",
    "999999", // all the same
    "123456",
    "234567",
    "456789",
    "890123",
    "012345", // counting up
    "654321",
    "987654",
    "543210",
    "210987", // counting down
    "121212",
    "909090",
    "123123",
    "456456",
    "007007", // simple repeats
    "112233",
    "123321",
    "147258",
    "159753",
    "696969",
    "102030", // well known
  ])("%s", (pin) => {
    expect(isCommonPin(pin)).toBe(true);
  });

  it.each(["482916", "730518", "261947", "593082", "847361", "135792", "100453"])(
    "allows %s",
    (pin) => {
      expect(isCommonPin(pin)).toBe(false);
    },
  );
});

describe("sign-in settings: the API refuses to start when they are wrong", () => {
  it("accepts good settings", () => {
    const s = loadAuthSettings(base);
    expect(s.provider).toBe("family-code-pin");
    expect(s.codeLookupSecret).toHaveLength(32);
    expect(s.appOrigin).toBe("https://tummytime.example.org");
    expect(loadAuthSettings({ ...base, APP_ORIGIN: "http://127.0.0.1:5173" }).appOrigin).toBe(
      "http://127.0.0.1:5173",
    );
  });

  it.each([
    ["missing", { APP_ORIGIN: base.APP_ORIGIN }, /CODE_LOOKUP_SECRET: missing/],
    [
      "blank (as in .env.example)",
      { ...base, CODE_LOOKUP_SECRET: "" },
      /CODE_LOOKUP_SECRET: missing/,
    ],
    [
      "too short",
      { ...base, CODE_LOOKUP_SECRET: randomBytes(16).toString("base64") },
      /at least 32/,
    ],
    ["not base64", { ...base, CODE_LOOKUP_SECRET: "this is not base64 at all, no!" }, /base64/],
    [
      "not random",
      { ...base, CODE_LOOKUP_SECRET: Buffer.alloc(48, 7).toString("base64") },
      /random/,
    ],
  ])("CODE_LOOKUP_SECRET %s", (_label, env, message) => {
    expect(() => loadAuthSettings(env)).toThrow(message);
  });

  it("never prints the secret's value", () => {
    const weak = Buffer.alloc(40, 65).toString("base64");
    expect(() => loadAuthSettings({ ...base, CODE_LOOKUP_SECRET: weak })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(weak) as unknown }),
    );
  });

  it.each([
    ["missing", undefined],
    ["with a path", "https://tummytime.example.org/app"],
    ["with a trailing slash", "https://tummytime.example.org/"],
    ["plain http on a real host", "http://tummytime.example.org"],
    ["not a URL", "tummytime"],
  ])("APP_ORIGIN %s", (_label, value) => {
    expect(() => loadAuthSettings({ ...base, APP_ORIGIN: value })).toThrow(/APP_ORIGIN/);
  });

  it.each([["production"], ["staging"], [undefined]])(
    "refuses AUTH_PROVIDER=dev-fake when NODE_ENV is %s",
    (nodeEnv) => {
      expect(() =>
        loadAuthSettings({ ...base, AUTH_PROVIDER: "dev-fake", NODE_ENV: nodeEnv }),
      ).toThrow(/dev-fake/);
    },
  );

  it.each([["development"], ["test"]])("allows dev-fake when NODE_ENV is %s", (nodeEnv) => {
    expect(
      loadAuthSettings({ ...base, AUTH_PROVIDER: "dev-fake", NODE_ENV: nodeEnv }).provider,
    ).toBe("dev-fake");
  });

  it("refuses an unknown provider", () => {
    expect(() => loadAuthSettings({ ...base, AUTH_PROVIDER: "magic-link" })).toThrow(
      /AUTH_PROVIDER/,
    );
  });

  it("the dev-fake provider itself cannot be built outside development and test", () => {
    const deps = {} as Parameters<typeof devFakeProvider>[0];
    expect(() => devFakeProvider(deps, "production")).toThrow(DevFakeRefused);
    expect(() => devFakeProvider(deps, "")).toThrow(DevFakeRefused);
  });

  it("the real API refuses to start with dev-fake in production, before it connects to anything", () => {
    const apiDir = fileURLToPath(new URL("../..", import.meta.url));
    const result = spawnSync("pnpm", ["exec", "tsx", "src/server.ts"], {
      cwd: apiDir,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        NODE_ENV: "production",
        AUTH_PROVIDER: "dev-fake",
        CODE_LOOKUP_SECRET: goodSecret,
        APP_ORIGIN: "https://tummytime.example.org",
        API_PORT: "3999",
        // Port 1 has no database: had it tried to connect, it would fail with another message.
        DB_PORT: "1",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/AUTH_PROVIDER is dev-fake/);
    expect(result.stderr).not.toMatch(/database/i);
  });

  it("the real API refuses to start without the secret, and does not print one", () => {
    const apiDir = fileURLToPath(new URL("../..", import.meta.url));
    const result = spawnSync("pnpm", ["exec", "tsx", "src/server.ts"], {
      cwd: apiDir,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        CODE_LOOKUP_SECRET: "",
        APP_ORIGIN: "https://tummytime.example.org",
        API_PORT: "3999",
        DB_PORT: "1",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/CODE_LOOKUP_SECRET: missing/);
  });
});

describe("dev-fake, in a test environment", () => {
  let t: AuthTestApp;
  beforeAll(async () => {
    t = await authTestApp({ provider: "dev-fake" });
  });
  afterAll(async () => {
    await t.close();
  });

  it("allows a simple PIN at sign-up and signs in with the code alone", async () => {
    const acct = await signUp(t, "111111");
    const start = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/start",
      headers: SAME_SITE,
    });
    expect(start.json()).toEqual({ method: "dev-fake" });
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/finish",
      headers: SAME_SITE,
      payload: { familyCode: acct.familyCode },
    });
    expect(res.statusCode).toBe(200);
    expect((await me(t, sessionToken(res) ?? "")).statusCode).toBe(200);
    const unknown = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-in/finish",
      headers: SAME_SITE,
      payload: { familyCode: "2345 6789 ABCD" },
    });
    expect(unknown.statusCode).toBe(401);
  });
});
