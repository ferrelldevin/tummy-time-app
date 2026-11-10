import { z } from "zod";

/** What GET /api/health returns. The API builds it and the web app checks it. */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
