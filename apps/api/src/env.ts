import { z } from "zod";

const envSchema = z.object({
  /** Required. No default on purpose: the API must be told where to listen. */
  API_PORT: z.coerce.number().int().min(1).max(65535),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

/** Reads and checks the environment. Throws EnvError with a plain message when it is wrong. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const given = new Map(Object.entries(source));
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join(".");
    const missing = (given.get(name) ?? "") === "";
    return `  - ${name}: ${missing ? "missing" : issue.message}`;
  });
  throw new EnvError(
    `The API cannot start because its settings are not right:\n${problems.join("\n")}\n` +
      "Copy .env.example to .env and fill in the values.",
  );
}
