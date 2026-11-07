import { z } from "zod";

import { MAX_JSON_BODY_BYTES } from "../validations/api.ts";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const { auth } = await import("@clerk/nextjs/server");
  const { isAuthenticated, userId } = await auth();
  return isAuthenticated && userId ? userId : null;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export function badRequestResponse(message = "Invalid request") {
  return Response.json({ error: message }, { status: 400 });
}

export function serverErrorResponse() {
  return Response.json({ error: "Unable to process request" }, { status: 500 });
}

export async function parseJsonBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  return schema.parse(JSON.parse(body));
}