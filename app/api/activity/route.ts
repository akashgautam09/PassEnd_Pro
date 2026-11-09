import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId, badRequestResponse, parseJsonBody, serverErrorResponse, unauthorizedResponse } from "@/lib/api/request";
import { ensureDatabaseIndexes, getDatabase } from "@/lib/db/mongodb";
import type { ActivityEventDocument } from "@/lib/db/types";
import { activityEventSchema, deleteActivitySchema, type DeleteActivityInput } from "@/lib/validations/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();
  const limited = await enforceRateLimit(`activity:get:${userId}`, 30);
  if (limited) return limited;
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
  const limited = await enforceRateLimit(`activity:write:${userId}`, 60);
  if (limited) return limited;
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

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  const limited = await enforceRateLimit(`activity:delete:${userId}`, 20, 60_000);
  if (limited) return limited;

  try {
    let payload: DeleteActivityInput;
    const url = new URL(request.url);
    const queryMode = url.searchParams.get("mode");

    if (queryMode) {
      const queryCount = url.searchParams.get("count");
      payload = deleteActivitySchema.parse(
        queryMode === "all"
          ? { mode: "all" }
          : { mode: queryMode, count: queryCount ? Number(queryCount) : undefined }
      );
    } else {
      payload = await parseJsonBody(request, deleteActivitySchema);
    }

    await ensureDatabaseIndexes();
    const collection = getDatabase().collection<ActivityEventDocument>("activity_events");

    if (payload.mode === "all") {
      const result = await collection.deleteMany({ userId });
      return NextResponse.json({ success: true, deletedCount: result.deletedCount, mode: "all" });
    } else {
      const itemsToDelete = await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(payload.count)
        .project({ _id: 1 })
        .toArray();

      if (itemsToDelete.length === 0) {
        return NextResponse.json({ success: true, deletedCount: 0, mode: "count", count: payload.count });
      }

      const ids = itemsToDelete.map((doc) => doc._id);
      const result = await collection.deleteMany({ _id: { $in: ids }, userId });

      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
        mode: "count",
        count: payload.count,
      });
    }
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return badRequestResponse();
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return serverErrorResponse();
  }
}