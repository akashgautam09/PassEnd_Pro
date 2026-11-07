import { z } from "zod";

import {
  createAdditionalData,
  decryptVaultItem,
  deriveMasterKey,
  encryptVaultItem,
  unwrapVaultEncryptionKey,
  unwrapVaultKeyWithRecoveryKey,
} from "../crypto/vault-crypto.ts";
import { hexToBytes, wipeBytes } from "../crypto/encoding.ts";
import type { Argon2idParameters } from "../crypto/types.ts";
import { getItemType, type VaultItemPayload } from "../types/vault.ts";

export const BACKUP_FORMAT = "passend-backup" as const;
export const BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024; // 25 MB

const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

export const backupManifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().datetime(),
  itemCount: z.number().int().nonnegative(),
});

export const backupProfileSchema = z.object({
  sourceAccountId: z.string().min(1).max(128),
  kdf: z.object({
    algorithm: z.string().min(1).max(64),
    salt: z.string().regex(base64Regex),
    parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  }),
  wrappedVaultKey: z.string().regex(base64Regex),
  wrapIv: z.string().regex(base64Regex),
  cryptoVersion: z.number().int().positive(),
  recoveryWrappedVaultKey: z.string().regex(base64Regex).optional(),
  recoveryWrapIv: z.string().regex(base64Regex).optional(),
  recoveryCryptoVersion: z.number().int().positive().optional(),
});

export const backupItemSchema = z.object({
  id: z.string().min(16).max(128),
  encryptedData: z.string().regex(base64Regex),
  iv: z.string().regex(base64Regex),
  cryptoVersion: z.number().int().positive(),
  version: z.number().int().positive(),
  isFavorite: z.boolean(),
  isTrash: z.boolean(),
  trashedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const backupFileSchema = z.object({
  manifest: backupManifestSchema,
  profile: backupProfileSchema,
  items: z.array(backupItemSchema),
}).refine(
  (data) => data.manifest.itemCount === data.items.length,
  { message: "Manifest item count does not match total items array length" }
);

export type PassEndBackupFile = z.infer<typeof backupFileSchema>;
export type PassEndBackupItem = z.infer<typeof backupItemSchema>;
export type PassEndBackupProfile = z.infer<typeof backupProfileSchema>;

export type RestoreProgress = {
  stage: "deriving_key" | "decrypting_records" | "re_encrypting" | "uploading" | "completed";
  current: number;
  total: number;
  message?: string;
};

export type RestoreSummary = {
  totalInBackup: number;
  imported: number;
  duplicatesSkipped: number;
  mode: "merge" | "replace";
};

/**
 * Generate a cryptographically sound .passend encrypted backup package.
 * Manifest contains only operational metadata. Vault records and wrapped keys remain encrypted.
 */
export function buildBackupPackage(
  profile: PassEndBackupProfile,
  items: PassEndBackupItem[]
): PassEndBackupFile {
  const file: PassEndBackupFile = {
    manifest: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      itemCount: items.length,
    },
    profile,
    items,
  };

  return backupFileSchema.parse(file);
}

/**
 * Triggers a secure browser download for the .passend backup file.
 */
export function triggerBackupDownload(backup: PassEndBackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split("T")[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = `passend-vault-backup-${dateStr}.passend`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an untrusted backup file from user input.
 */
export function parseAndValidateBackup(fileText: string): PassEndBackupFile {
  if (fileText.length > MAX_BACKUP_BYTES) {
    throw new Error("Backup file exceeds maximum allowed size (25MB)");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("Invalid file format: not a valid JSON document");
  }

  const result = backupFileSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues.map((e) => e.message).join(", ");
    throw new Error(`Backup validation failed: ${errorDetails}`);
  }

  return result.data;
}

/**
 * Restore an encrypted backup into the current vault.
 * - Authenticates the source VEK using the provided source Master Password or Recovery Key.
 * - Decrypts source records locally in the browser.
 * - Re-encrypts each record with the destination VEK and fresh random IV.
 * - Submits bounded batches to the server.
 */
export async function restoreEncryptedBackup(params: {
  backup: PassEndBackupFile;
  credential: { password?: string; recoveryKey?: string };
  destinationVaultKey: Uint8Array;
  destinationAccountId: string;
  existingItemTitles?: Set<string>;
  mode: "merge" | "replace";
  onProgress?: (progress: RestoreProgress) => void;
}): Promise<RestoreSummary> {
  const {
    backup,
    credential,
    destinationVaultKey,
    destinationAccountId,
    existingItemTitles = new Set(),
    mode,
    onProgress,
  } = params;

  if (!credential.password && !credential.recoveryKey) {
    throw new Error("A source Master Password or Recovery Key is required to unwrap the backup");
  }

  onProgress?.({ stage: "deriving_key", current: 0, total: backup.items.length, message: "Unwrapping backup encryption key..." });

  let sourceVaultKey: Uint8Array | null = null;
  let sourceDerivedKey: Uint8Array | null = null;

  try {
    // 1. Unwrap the source VEK
    if (credential.password) {
      const kdf = backup.profile.kdf;
      if (kdf.algorithm !== "Argon2id") {
        throw new Error(`Unsupported KDF algorithm in backup: ${kdf.algorithm}`);
      }
      const argonParams: Argon2idParameters = {
        algorithm: "Argon2id",
        salt: kdf.salt,
        version: 1,
        memoryKiB: Number(kdf.parameters.memoryKiB),
        iterations: Number(kdf.parameters.iterations),
        parallelism: Number(kdf.parameters.parallelism),
        hashLength: Number(kdf.parameters.hashLength),
        passwordEncoding: "UTF-8-NFKC",
      };

      sourceDerivedKey = await deriveMasterKey(credential.password, argonParams);
      const sourceAdditionalData = createAdditionalData(
        backup.profile.sourceAccountId,
        "vault-key",
        backup.profile.cryptoVersion
      );

      sourceVaultKey = await unwrapVaultEncryptionKey(
        {
          cryptoVersion: backup.profile.cryptoVersion as 1,
          ciphertext: backup.profile.wrappedVaultKey,
          iv: backup.profile.wrapIv,
        },
        sourceDerivedKey,
        sourceAdditionalData
      );
      wipeBytes(sourceAdditionalData);
    } else if (credential.recoveryKey) {
      if (!backup.profile.recoveryWrappedVaultKey || !backup.profile.recoveryWrapIv) {
        throw new Error("This backup file does not contain a recovery key envelope");
      }
      const rawRecoveryKey = hexToBytes(credential.recoveryKey);
      const recoveryAdditionalData = createAdditionalData(
        backup.profile.sourceAccountId,
        "recovery-key-wrap",
        backup.profile.recoveryCryptoVersion ?? 1
      );

      sourceVaultKey = await unwrapVaultKeyWithRecoveryKey(
        {
          cryptoVersion: (backup.profile.recoveryCryptoVersion ?? 1) as 1,
          ciphertext: backup.profile.recoveryWrappedVaultKey,
          iv: backup.profile.recoveryWrapIv,
        },
        rawRecoveryKey,
        recoveryAdditionalData
      );
      wipeBytes(rawRecoveryKey);
      wipeBytes(recoveryAdditionalData);
    }

    if (!sourceVaultKey) {
      throw new Error("Unable to unwrap source backup vault key");
    }

    // 2. Decrypt each item and re-encrypt under destination VEK
    const totalItems = backup.items.length;
    let decryptedCount = 0;
    const reEncryptedItems: Array<{
      id: string;
      encryptedData: string;
      iv: string;
      cryptoVersion: 1;
      isFavorite: boolean;
    }> = [];
    let duplicatesSkipped = 0;

    for (const item of backup.items) {
      onProgress?.({
        stage: "decrypting_records",
        current: decryptedCount + 1,
        total: totalItems,
        message: `Decrypting and inspecting item ${decryptedCount + 1} of ${totalItems}...`,
      });

      // Decrypt locally using source key & source AAD
      let payload: VaultItemPayload;
      try {
        payload = await decryptVaultItem<VaultItemPayload>(
          {
            cryptoVersion: item.cryptoVersion as 1,
            encryptedData: item.encryptedData,
            iv: item.iv,
          },
          sourceVaultKey,
          backup.profile.sourceAccountId,
          item.id
        );
      } catch {
        throw new Error(`Failed to decrypt backup item ${item.id}. The provided password or recovery key is incorrect.`);
      }

      // Check duplicates in merge mode
      const itemTitleKey = `${getItemType(payload)}:${payload.title.trim().toLowerCase()}`;
      if (mode === "merge" && existingItemTitles.has(itemTitleKey)) {
        duplicatesSkipped += 1;
        decryptedCount += 1;
        continue;
      }

      // Generate a fresh random item ID for destination vault
      const newId = generateRandomItemId();

      // Re-encrypt under destination VEK with a fresh 12-byte IV and destination AAD
      const reEncrypted = await encryptVaultItem(
        payload,
        destinationVaultKey,
        destinationAccountId,
        newId
      );

      reEncryptedItems.push({
        id: newId,
        encryptedData: reEncrypted.encryptedData,
        iv: reEncrypted.iv,
        cryptoVersion: 1,
        isFavorite: item.isFavorite,
      });

      decryptedCount += 1;
    }

    // 3. In replace mode, safely clear existing items before uploading restored records
    if (mode === "replace") {
      onProgress?.({
        stage: "uploading",
        current: 0,
        total: reEncryptedItems.length,
        message: "Clearing existing vault items for replacement...",
      });
      const delRes = await fetch("/api/vault/batch", { method: "DELETE" });
      if (!delRes.ok) {
        throw new Error(`Failed to clear existing vault items in replace mode: status ${delRes.status}`);
      }
    }

    // 4. Send to server in bounded batches
    const BATCH_SIZE = 25;
    let uploadedCount = 0;
    const totalToUpload = reEncryptedItems.length;

    for (let i = 0; i < totalToUpload; i += BATCH_SIZE) {
      const batch = reEncryptedItems.slice(i, i + BATCH_SIZE);
      onProgress?.({
        stage: "uploading",
        current: uploadedCount,
        total: totalToUpload,
        message: `Saving items ${i + 1} to ${Math.min(i + batch.length, totalToUpload)}...`,
      });

      const response = await fetch("/api/vault/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: batch }),
      });

      if (!response.ok) {
        throw new Error(`Batch upload failed with status ${response.status}`);
      }

      uploadedCount += batch.length;
    }

    onProgress?.({
      stage: "completed",
      current: totalToUpload,
      total: totalToUpload,
      message: "Restore completed successfully!",
    });

    return {
      totalInBackup: totalItems,
      imported: totalToUpload,
      duplicatesSkipped,
      mode,
    };
  } finally {
    // Zero sensitive byte buffers immediately
    if (sourceVaultKey) wipeBytes(sourceVaultKey);
    if (sourceDerivedKey) wipeBytes(sourceDerivedKey);
  }
}

function generateRandomItemId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
