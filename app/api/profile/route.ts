import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseIndexes, getDatabase } from "@/lib/db/mongodb";
import { getAuthenticatedUserId, badRequestResponse, parseJsonBody, serverErrorResponse, unauthorizedResponse } from "@/lib/api/request";
import { profileSchema } from "@/lib/validations/api";
import type { UserVaultDocument } from "@/lib/db/types";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  try {
    await ensureDatabaseIndexes();
    const profile = await getDatabase().collection<UserVaultDocument>("user_vaults").findOne({ _id: userId });
    if (!profile) return NextResponse.json({ profile: null });

    return NextResponse.json({
      profile: {
        kdf: profile.kdf,
        wrappedVaultKey: profile.wrappedVaultKey,
        wrapIv: profile.wrapIv,
        cryptoVersion: profile.cryptoVersion,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch {
    return serverErrorResponse();
  }
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  try {
    const payload = await parseJsonBody(request, profileSchema);
    await ensureDatabaseIndexes();
    const now = new Date();
    const collection = getDatabase().collection<UserVaultDocument>("user_vaults");
    await collection.updateOne(
      { _id: userId },
      { $set: { ...payload, updatedAt: now }, $setOnInsert: { _id: userId, createdAt: now } },
      { upsert: true },
    );

    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return badRequestResponse();
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return serverErrorResponse();
  }
}