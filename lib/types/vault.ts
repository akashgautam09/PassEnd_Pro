import type { TotpConfig } from "@/lib/crypto/totp";

export type VaultItemType = "login" | "note";

export type LoginPayload = {
  type?: "login";
  title: string;
  category?: string;
  website: string;
  username: string;
  password: string;
  notes: string;
  totp?: TotpConfig;
};

export type SecureNotePayload = {
  type: "note";
  title: string;
  category?: string;
  content: string; // The encrypted note body (plain text or markdown)
};

export type VaultItemPayload =
  | ({ type?: "login" } & LoginPayload)
  | ({ type: "note" } & SecureNotePayload);

export function getItemType(payload: Record<string, unknown>): VaultItemType {
  if (payload.type === "note") return "note";
  if (payload.type === "login") return "login";
  if (typeof payload.content === "string" && payload.password === undefined) return "note";
  return "login";
}

export function isSecureNote(payload: unknown): payload is SecureNotePayload {
  if (!payload || typeof payload !== "object") return false;
  return getItemType(payload as Record<string, unknown>) === "note";
}

export function isLogin(payload: unknown): payload is LoginPayload {
  if (!payload || typeof payload !== "object") return false;
  return getItemType(payload as Record<string, unknown>) === "login";
}
