import { NextResponse } from "next/server";

import { getAuthenticatedUserId, badRequestResponse, parseJsonBody, serverErrorResponse, unauthorizedResponse } from "@/lib/api/request";
import { ensureDatabaseIndexes, getDatabase } from "@/lib/db/mongodb";
import type { VaultItemDocument } from "@/lib/db/types";
import { updateVaultItemSchema } from "@/lib/validations/api";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();
  const limited = await enforceRateLimit(`vault:get:${userId}`, 60);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    await ensureDatabaseIndexes();
    const item = await getDatabase().collection<VaultItemDocument>("vault_items").findOne({ _id: id, userId });
    if (!item) return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch {
    return serverErrorResponse();
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();
  const limited = await enforceRateLimit(`vault:write:${userId}`, 30);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const payload = await parseJsonBody(request, updateVaultItemSchema);
    const now = new Date();
    const update: Partial<VaultItemDocument> = { updatedAt: now, version: payload.version + 1 };

    if (payload.encryptedData !== undefined) update.encryptedData = payload.encryptedData;
    if (payload.iv !== undefined) update.iv = payload.iv;
    if (payload.cryptoVersion !== undefined) update.cryptoVersion = payload.cryptoVersion;
    if (payload.isFavorite !== undefined) update.isFavorite = payload.isFavorite;
    if (payload.isTrash !== undefined) {
      update.isTrash = payload.isTrash;
      update.trashedAt = payload.isTrash ? now : null;
      update.purgeAt = payload.isTrash ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    }

    await ensureDatabaseIndexes();
    const result = await getDatabase().collection<VaultItemDocument>("vault_items").findOneAndUpdate(
      { _id: id, userId, $or: [{ version: payload.version }, { version: { $exists: false } }] },
      { $set: update },
      { returnDocument: "after" },
    );
    if (!result) {
      const current = await getDatabase().collection<VaultItemDocument>("vault_items").findOne({ _id: id, userId }, { projection: { _id: 1 } });
      return current ? NextResponse.json({ error: "Vault item has changed. Reload before saving." }, { status: 409 }) : NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }
    return NextResponse.json({ item: result });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return badRequestResponse();
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return serverErrorResponse();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();
  const limited = await enforceRateLimit(`vault:write:${userId}`, 30);
  if (limited) return limited;

  try {
    const { id } = await context.params;
    await ensureDatabaseIndexes();
    const version = Number(new URL(_request.url).searchParams.get("version"));
    if (!Number.isInteger(version) || version < 1) return badRequestResponse("Item version is required");
    const result = await getDatabase().collection<VaultItemDocument>("vault_items").deleteOne({ _id: id, userId, $or: [{ version }, { version: { $exists: false } }] });
    if (result.deletedCount === 0) {
      const existing = await getDatabase().collection<VaultItemDocument>("vault_items").findOne({ _id: id, userId }, { projection: { _id: 1 } });
      return existing
        ? NextResponse.json({ error: "Vault item has changed. Reload before deleting." }, { status: 409 })
        : NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch {
    return serverErrorResponse();
  }
}