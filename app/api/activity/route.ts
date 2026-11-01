import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId, badRequestResponse, parseJsonBody, serverErrorResponse, unauthorizedResponse } from "@/lib/api/request";
import { ensureDatabaseIndexes, getDatabase } from "@/lib/db/mongodb";
import type { ActivityEventDocument } from "@/lib/db/types";
import { activityEventSchema } from "@/lib/validations/api";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();
  try {
    await ensureDatabaseIndexes();
    const events = await getDatabase().collection<ActivityEventDocument>("activity_events").find({ userId }).sort({ createdAt: -1 }).limit(100).project({ _id: 0, eventType: 1, createdAt: 1 }).toArray();
    return NextResponse.json({ events });
  } catch {
    return serverErrorResponse();
  }
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();
  try {
    const payload = await parseJsonBody(request, activityEventSchema);
    await ensureDatabaseIndexes();
    await getDatabase().collection<ActivityEventDocument>("activity_events").insertOne({ userId, eventType: payload.eventType, createdAt: new Date() });
    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return badRequestResponse();
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return serverErrorResponse();
  }
}