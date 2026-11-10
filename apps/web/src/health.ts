import { healthResponseSchema } from "@tummy/shared";

/** Calls GET /api/health. Resolves true only if the answer matches the shared schema. */
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/health", signal ? { signal } : {});
    if (!response.ok) {
      return false;
    }
    return healthResponseSchema.safeParse(await response.json()).success;
  } catch {
    return false;
  }
}
