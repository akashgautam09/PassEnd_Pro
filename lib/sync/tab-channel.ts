"use client";

import { z } from "zod";

export const VAULT_CHANNEL_NAME = "passend:vault-coordination";

const vaultChannelMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("VAULT_LOCKED"),
    sourceTabId: z.string().min(1).max(64),
    timestamp: z.number().positive(),
  }),
  z.object({
    type: z.literal("VAULT_MUTATED"),
    sourceTabId: z.string().min(1).max(64),
    timestamp: z.number().positive(),
    itemId: z.string().max(128).optional(),
    action: z.enum(["created", "updated", "trashed", "restored", "deleted"]).optional(),
  }),
  z.object({
    type: z.literal("SESSION_SIGNED_OUT"),
    sourceTabId: z.string().min(1).max(64),
    timestamp: z.number().positive(),
  }),
]);

export type VaultChannelMessage = z.infer<typeof vaultChannelMessageSchema>;

export type VaultEventPayload =
  | { type: "VAULT_LOCKED" }
  | { type: "VAULT_MUTATED"; itemId?: string; action?: "created" | "updated" | "trashed" | "restored" | "deleted" }
  | { type: "SESSION_SIGNED_OUT" };

// Unique random tab ID for the current browser tab session
export const currentTabId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : `tab_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Validate that an incoming broadcast payload is well-formed and safe.
 * Rejects any message containing key materials, passwords, or invalid shapes.
 */
export function validateChannelMessage(data: unknown): VaultChannelMessage | null {
  const result = vaultChannelMessageSchema.safeParse(data);
  if (!result.success) return null;

  // Extra safety assertion: reject any accidental secret leakage fields
  const raw = data as Record<string, unknown>;
  if (
    "password" in raw ||
    "key" in raw ||
    "secret" in raw ||
    "vaultKey" in raw ||
    "encryptedData" in raw ||
    "kek" in raw ||
    "vek" in raw
  ) {
    console.error("[TabSync] Rejected unsafe broadcast message containing potential secret fields");
    return null;
  }

  return result.data;
}

/**
 * Broadcast an event to all other open tabs in this browser profile.
 * Silently does nothing if BroadcastChannel is not supported.
 */
export function broadcastVaultEvent(event: VaultEventPayload): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

  try {
    const channel = new BroadcastChannel(VAULT_CHANNEL_NAME);
    const message: VaultChannelMessage = {
      ...event,
      sourceTabId: currentTabId,
      timestamp: Date.now(),
    };

    channel.postMessage(message);
    channel.close();
  } catch {
    // Ignore BroadcastChannel errors in restricted browser contexts
  }
}

/**
 * Subscribe to cross-tab vault coordination events.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToVaultEvents(
  listener: (message: VaultChannelMessage) => void
): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => {};
  }

  let channel: BroadcastChannel | null = null;

  try {
    channel = new BroadcastChannel(VAULT_CHANNEL_NAME);
    const onMessage = (event: MessageEvent) => {
      const validated = validateChannelMessage(event.data);
      if (!validated) return;

      // Ignore messages broadcast by this same tab
      if (validated.sourceTabId === currentTabId) return;

      listener(validated);
    };

    channel.addEventListener("message", onMessage);

    return () => {
      if (channel) {
        channel.removeEventListener("message", onMessage);
        channel.close();
        channel = null;
      }
    };
  } catch {
    return () => {};
  }
}
