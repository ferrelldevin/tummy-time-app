import { z } from "zod";
import { EnvError } from "../env.js";

/**
 * Database settings, read from the environment only. No password is ever written in a file
 * in this repo; .env.example leaves them blank.
 *
 * Two database users (docs/data-map.md, "Who can read what"):
 * - the app user can read and write rows, and nothing else. The API connects as this user.
 * - the migrator user owns the tables. Only db:migrate, db:reset and backups use it.
 */
const identifier = z
  .string()
  .regex(/^[a-z_][a-z0-9_]{0,62}$/, "use lowercase letters, digits and _ only");

const common = {
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: identifier,
};

const appSchema = z.object({
  ...common,
  DB_APP_USER: identifier,
  DB_APP_PASSWORD: z.string().min(1),
});

const migratorSchema = z.object({
  ...common,
  DB_MIGRATOR_USER: identifier,
  DB_MIGRATOR_PASSWORD: z.string().min(1),
  /** The migrator grants row access on every table to this user after each migration. */
  DB_APP_USER: identifier,
});

export interface DbSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface MigratorSettings extends DbSettings {
  appUser: string;
}

function parse<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const given = new Map(Object.entries(source));
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join(".");
    const missing = (given.get(name) ?? "") === "";
    // Never echo the value: it may be a password.
    return `  - ${name}: ${missing ? "missing" : issue.message}`;
  });
  throw new EnvError(
    `The database settings are not right:\n${problems.join("\n")}\n` +
      "Copy .env.example to .env and fill in the values. docs/runbook.md shows how to make the database users.",
  );
}

/** Settings for the API itself: the low-privilege app user. */
export function loadAppDbSettings(
  source: Record<string, string | undefined> = process.env,
): DbSettings {
  const env = parse(appSchema, source);
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_APP_USER,
    password: env.DB_APP_PASSWORD,
  };
}

/** Settings for migrations, reset and seed tooling: the user that owns the tables. */
export function loadMigratorDbSettings(
  source: Record<string, string | undefined> = process.env,
): MigratorSettings {
  const env = parse(migratorSchema, source);
  if (env.DB_MIGRATOR_USER === env.DB_APP_USER) {
    throw new EnvError(
      "The database settings are not right:\n" +
        "  - DB_MIGRATOR_USER and DB_APP_USER must be two different users.",
    );
  }
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_MIGRATOR_USER,
    password: env.DB_MIGRATOR_PASSWORD,
    appUser: env.DB_APP_USER,
  };
}
