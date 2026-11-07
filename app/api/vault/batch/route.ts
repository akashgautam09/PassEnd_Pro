import { NextResponse } from "next/server";
import { z } from "zod";

import {
  badRequestResponse,
  getAuthenticatedUserId,
  parseJsonBody,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/request";
import { ensureDatabaseIndexes, getDatabase } from "@/lib/db/mongodb";
import type { VaultItemDocument } from "@/lib/db/types";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { batchCreateVaultItemSchema } from "@/lib/validations/api";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  const limited = await enforceRateLimit(`vault:batch:${userId}`, 15, 60_000);
  if (limited) return limited;

  try {
    const payload = await parseJsonBody(request, batchCreateVaultItemSchema);
    await ensureDatabaseIndexes();
    const now = new Date();

    const collection = getDatabase().collection<VaultItemDocument>("vault_items");

    // Perform atomic upserts with setOnInsert so existing records are not silently overwritten
    const operations = payload.items.map((item) => ({
      updateOne: {
        filter: { _id: item.id, userId },
        update: {
          $setOnInsert: {
            _id: item.id,
            userId,
            encryptedData: item.encryptedData,
            iv: item.iv,
            cryptoVersion: item.cryptoVersion,
            version: 1,
            isFavorite: item.isFavorite,
            isTrash: false,
            trashedAt: null,
            purgeAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });

    return NextResponse.json(
      {
        success: true,
        upsertedCount: result.upsertedCount,
        matchedCount: result.matchedCount,
        total: payload.items.length,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return badRequestResponse();
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    return serverErrorResponse();
  }
}

export async function DELETE() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorizedResponse();

  const limited = await enforceRateLimit(`vault:batch_delete:${userId}`, 5, 60_000);
  if (limited) return limited;

  try {
    await ensureDatabaseIndexes();
    const result = await getDatabase().collection<VaultItemDocument>("vault_items").deleteMany({ userId });
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch {
    return serverErrorResponse();
  }
}
