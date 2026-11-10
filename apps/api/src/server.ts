import { buildApp } from "./app.js";
import { EnvError, loadEnv } from "./env.js";

try {
  const env = loadEnv();
  const app = buildApp(env);
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (error) {
  if (error instanceof EnvError) {
    console.error(error.message);
  } else {
    console.error("The API failed to start.", error);
  }
  process.exit(1);
}
