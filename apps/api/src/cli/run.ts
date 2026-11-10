import { EnvError } from "../env.js";

/**
 * Runs a command-line task and turns any failure into a plain message and exit code 1.
 * Error details from the database are not printed in full: they can quote row values.
 */
export async function runCli(name: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (error instanceof EnvError || error instanceof CliRefusal) {
      console.error(`${name}: ${error.message}`);
    } else {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      const kind = error instanceof Error ? error.name : "Error";
      console.error(`${name} failed (${kind}${code ? ` ${code}` : ""}). Is the database running?`);
    }
    process.exitCode = 1;
  }
}

/** A task that decided on purpose not to run. */
export class CliRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliRefusal";
  }
}
