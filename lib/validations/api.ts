import { z } from "zod";

export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Must be base64 encoded");

const kdfParameters = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const profileSchema = z.object({
  kdf: z.object({
    algorithm: z.string().trim().min(1).max(64),
    salt: base64.min(8).max(256),
    parameters: kdfParameters,
  }),
  wrappedVaultKey: base64.min(16).max(4096),
  wrapIv: base64.min(8).max(256),
  cryptoVersion: z.number().int().positive().max(100),
  recoveryWrappedVaultKey: base64.min(16).max(4096).optional(),
  recoveryWrapIv: base64.min(8).max(256).optional(),
  recoveryCryptoVersion: z.number().int().positive().max(100).optional(),
});

const encryptedRecordFields = {
  encryptedData: base64.min(16).max(MAX_JSON_BODY_BYTES),
  iv: base64.min(8).max(256),
  cryptoVersion: z.number().int().positive().max(100),
};

export const createVaultItemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, "Invalid item ID"),
  ...encryptedRecordFields,
  isFavorite: z.boolean().default(false),
});

export const updateVaultItemSchema = z
  .object(encryptedRecordFields)
  .partial()
  .extend({
    version: z.number().int().positive(),
    isFavorite: z.boolean().optional(),
    isTrash: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const vaultListFilterSchema = z.enum(["active", "trash", "all"]);

export const batchCreateVaultItemSchema = z.object({
  items: z.array(createVaultItemSchema).min(1).max(100),
});

export const activityEventSchema = z.object({
  eventType: z.enum([
    "vault_created",
    "vault_unlocked",
    "vault_locked",
    "item_created",
    "item_updated",
    "item_trashed",
    "item_restored",
    "item_deleted",
    "master_password_changed",
    "recovery_key_regenerated",
  ]),
});

export const deleteActivitySchema = z.union([
  z.object({
    mode: z.literal("count"),
    count: z.coerce.number().pipe(z.union([z.literal(5), z.literal(10)])),
  }),
  z.object({
    mode: z.literal("all"),
  }),
]);

export type DeleteActivityInput = z.infer<typeof deleteActivitySchema>;