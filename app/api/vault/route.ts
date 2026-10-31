import { NextResponse } from "next/server";

import { getAuthenticatedUserId, badRequestResponse, parseJsonBody, serverErrorResponse, unauthorizedResponse } from "@/lib/api/request";
import { ensureDatabaseIndexes, getDatabase } from "@/lib/db/mongodb";
import type { VaultItemDocument } from "@/lib/db/types";
import { createVaultItemSchema, vaultListFilterSchema } from "@/lib/validations/api";
import { z } from "zod";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  const filterResult = vaultListFilterSchema.safeParse(new URL(request.url).searchParams.get("trash") ?? "active");
  if (!filterResult.success) return badRequestResponse("Invalid trash filter");

  try {
    await ensureDatabaseIndexes();
    const filter = filterResult.data === "all" ? {} : { isTrash: filterResult.data === "trash" };
    const items = await getDatabase()
      .collection<VaultItemDocument>("vault_items")
      .find({ userId, ...filter })
      .sort({ updatedAt: -1 })
      .project({ _id: 1, encryptedData: 1, iv: 1, cryptoVersion: 1, isFavorite: 1, isTrash: 1, trashedAt: 1, purgeAt: 1, createdAt: 1, updatedAt: 1 })
      .toArray();

    return NextResponse.json({ items });
  } catch {
    return serverErrorResponse();
  }
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  try {
    const payload = await parseJsonBody(request, createVaultItemSchema);
    await ensureDatabaseIndexes();
    const now = new Date();
    const item: VaultItemDocument = {
      _id: payload.id,
      userId,
      encryptedData: payload.encryptedData,
      iv: payload.iv,
      cryptoVersion: payload.cryptoVersion,
      isFavorite: payload.isFavorite,
      isTrash: false,
      trashedAt: null,
      purgeAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await getDatabase().collection<VaultItemDocument>("vault_items").insertOne(item);
    return NextResponse.json({ item: { ...item } }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return badRequestResponse();
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return serverErrorResponse();
  }
}