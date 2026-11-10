import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from "fastify";
import { z } from "zod";
import { apiErrorSchema, type ApiErrorBody, type ApiErrorCode } from "@tummy/shared";

/**
 * THE API RULES, in one place. Every route follows them:
 *
 * 1. A route is added only with defineRoute(). It declares a Zod schema for its params, query,
 *    body and response. A route added any other way makes the app refuse to start.
 * 2. Input schemas are strict: a field the schema does not name is a 400, at every depth.
 *    A route with no body schema accepts no body; with no query schema, no query string.
 * 3. The response is checked against its schema before it is sent. Extra fields never leave.
 * 4. Every error has one shape, { "error": { "code", "message" } }, with a fixed message per
 *    code. Stack traces, SQL and internal messages are logged (redacted), never sent.
 */

declare module "fastify" {
  interface FastifyContextConfig {
    /** Set only by defineRoute(). */
    apiRules?: true;
  }
}

/** The fixed message for each code. Never an internal message. */
function messageFor(code: ApiErrorCode): string {
  switch (code) {
    case "bad_request":
      return "The request is not valid.";
    case "not_found":
      return "There is nothing at this address.";
    case "payload_too_large":
      return "The request is too large.";
    case "unsupported_media_type":
      return "Send the request as JSON.";
    case "rate_limited":
      return "Too many requests. Please wait a moment and try again.";
    case "internal_error":
      return "Something went wrong on our side. Please try again.";
  }
}

/** Throw this from a handler to send a specific error. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: ApiErrorCode,
  ) {
    super(messageFor(errorCode));
    this.name = "ApiError";
  }
}

export function errorBody(code: ApiErrorCode): ApiErrorBody {
  return apiErrorSchema.parse({ error: { code, message: messageFor(code) } });
}

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 404:
      return "not_found";
    case 413:
      return "payload_too_large";
    case 415:
      return "unsupported_media_type";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "internal_error" : "bad_request";
  }
}

function statusOf(error: unknown): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }
  // Fastify's own errors (bad JSON, body too large, wrong content type) and the rate limiter
  // carry a 4xx status. Anything without one is a bug on our side.
  const status = (error as Partial<FastifyError> | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 500 ? status : 500;
}

/** Installs the error handler, the not-found handler and the route check. Call it first. */
export function applyApiRules(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    if (route.config?.apiRules !== true) {
      throw new Error(
        `Route ${String(route.method)} ${route.url} was not added with defineRoute(). ` +
          "Every route must declare its input and output schemas (src/http/api-rules.ts).",
      );
    }
  });

  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const status = statusOf(error);
    const code = error instanceof ApiError ? error.errorCode : codeForStatus(status);
    if (status >= 500) {
      request.log.error({ err: error }, "request failed");
    } else {
      request.log.info({ errorCode: code, statusCode: status }, "request refused");
    }
    return reply.status(status).send(errorBody(code));
  });
}

/** The not-found reply. Registered by buildApp() after the rate limiter, so 404s are limited too. */
export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send(errorBody("not_found"));
}

// ---------------------------------------------------------------------------------------------
// Strictness check

interface LooseDef {
  type: string;
  shape?: Record<string, z.ZodType>;
  catchall?: z.ZodType;
  element?: z.ZodType;
  innerType?: z.ZodType;
  options?: readonly z.ZodType[];
  in?: z.ZodType;
  out?: z.ZodType;
  items?: readonly z.ZodType[];
  rest?: z.ZodType | null;
  valueType?: z.ZodType;
  left?: z.ZodType;
  right?: z.ZodType;
}

function defOf(schema: z.ZodType): LooseDef {
  return schema._zod.def;
}

/** Lists every object inside `schema` that would let unknown fields through. */
export function findLooseObjects(schema: z.ZodType, path = "(root)"): string[] {
  const def = defOf(schema);
  const children: [string, z.ZodType][] = [];
  const problems: string[] = [];
  switch (def.type) {
    case "object": {
      if (def.catchall === undefined || defOf(def.catchall).type !== "never") {
        problems.push(path);
      }
      for (const [key, child] of Object.entries(def.shape ?? {})) {
        children.push([`${path}.${key}`, child]);
      }
      break;
    }
    case "array":
    case "set":
      if (def.element) children.push([`${path}[]`, def.element]);
      break;
    case "record":
    case "map":
      if (def.valueType) children.push([`${path}{}`, def.valueType]);
      break;
    case "tuple":
      (def.items ?? []).forEach((item, i) => children.push([`${path}[${String(i)}]`, item]));
      if (def.rest) children.push([`${path}[...]`, def.rest]);
      break;
    case "union":
      (def.options ?? []).forEach((option, i) => children.push([`${path}|${String(i)}`, option]));
      break;
    case "intersection":
      if (def.left) children.push([path, def.left]);
      if (def.right) children.push([path, def.right]);
      break;
    case "pipe":
      if (def.in) children.push([path, def.in]);
      if (def.out) children.push([path, def.out]);
      break;
    default:
      if (def.innerType) children.push([path, def.innerType]);
  }
  for (const [childPath, child] of children) {
    problems.push(...findLooseObjects(child, childPath));
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// defineRoute

type ObjectSchema = z.ZodObject;

export interface RouteSpec<
  P extends ObjectSchema,
  Q extends ObjectSchema,
  B extends ObjectSchema,
  R extends z.ZodType,
> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  params?: P;
  querystring?: Q;
  body?: B;
  response: R;
  /** Success status. Default 200. */
  status?: number;
  handler: (input: {
    params: z.infer<P>;
    query: z.infer<Q>;
    body: z.infer<B>;
    request: FastifyRequest;
    reply: FastifyReply;
  }) => z.input<R> | Promise<z.input<R>>;
}

const NOTHING = z.strictObject({});

function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new ApiError(400, "bad_request");
  }
  return result.data;
}

export function defineRoute<
  P extends ObjectSchema = typeof NOTHING,
  Q extends ObjectSchema = typeof NOTHING,
  B extends ObjectSchema = typeof NOTHING,
  R extends z.ZodType = z.ZodType,
>(app: FastifyInstance, spec: RouteSpec<P, Q, B, R>): void {
  const where = `${spec.method} ${spec.url}`;
  for (const [part, schema] of [
    ["params", spec.params],
    ["querystring", spec.querystring],
    ["body", spec.body],
    ["response", spec.response],
  ] as const) {
    if (schema === undefined) continue;
    const loose = findLooseObjects(schema);
    if (loose.length > 0) {
      throw new Error(
        `${where}: the ${part} schema must use z.strictObject() everywhere (loose at ${loose.join(", ")}).`,
      );
    }
  }
  const paramsSchema = spec.params ?? NOTHING;
  const querySchema = spec.querystring ?? NOTHING;
  const bodySchema = spec.body;

  const handler: RouteHandlerMethod = async (request, reply) => {
    const params = parseInput(paramsSchema, request.params) as z.infer<P>;
    const query = parseInput(querySchema, request.query) as z.infer<Q>;
    let body: z.infer<B>;
    if (bodySchema === undefined) {
      if (request.body !== undefined && request.body !== null) {
        throw new ApiError(400, "bad_request");
      }
      body = {} as z.infer<B>;
    } else {
      body = parseInput(bodySchema, request.body);
    }
    const output = await spec.handler({ params, query, body, request, reply });
    const checked = spec.response.safeParse(output);
    if (!checked.success) {
      // A bug: the handler built something its own schema does not allow. Log, send a 500.
      throw new Error(`${where}: response did not match its schema.`);
    }
    return reply.status(spec.status ?? 200).send(checked.data);
  };

  app.route({ method: spec.method, url: spec.url, config: { apiRules: true }, handler });
}
