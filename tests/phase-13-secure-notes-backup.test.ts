import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSecureNote,
  isLogin,
  type SecureNotePayload,
  type LoginPayload,
} from "../lib/types/vault.ts";
import {
  encryptVaultItem,
  decryptVaultItem,
  generateVaultEncryptionKey,
  generateRecoveryKey,
  formatRecoveryKey,
  wrapVaultKeyWithRecoveryKey,
  unwrapVaultKeyWithRecoveryKey,
  createAdditionalData,
} from "../lib/crypto/vault-crypto.ts";
import { bytesToBase64, bytesToHex } from "../lib/crypto/encoding.ts";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildBackupPackage,
  parseAndValidateBackup,
  restoreEncryptedBackup,
  type PassEndBackupProfile,
  type PassEndBackupItem,
} from "../lib/backup/backup-service.ts";
import { batchCreateVaultItemSchema } from "../lib/validations/api.ts";

describe("Phase 13.1 — Secure Notes Cryptographic Envelope & Payload Discrimination", () => {
  it("discriminates between login and note payloads accurately", () => {
    const loginItem: LoginPayload = {
      type: "login",
      title: "GitHub Personal",
      username: "octocat",
      password: "CorrectHorseBatteryStaple",
      website: "https://github.com",
      notes: "Dev account",
    };

    const noteItem: SecureNotePayload = {
      type: "note",
      title: "Server Deployment Runbook",
      content: "# Production Runbook\n\n1. Check status\n2. Run migrations",
      category: "work",
    };

    assert.strictEqual(isLogin(loginItem), true);
    assert.strictEqual(isSecureNote(loginItem), false);

    assert.strictEqual(isSecureNote(noteItem), true);
    assert.strictEqual(isLogin(noteItem), false);
  });

  it("seals Secure Note markdown content and title in AES-256-GCM ciphertext", async () => {
    const vek = generateVaultEncryptionKey();
    const userId = "usr_phase13_test_alice";
    const itemId = "note_item_0123456789abcdef";

    const note: SecureNotePayload = {
      type: "note",
      title: "Confidential Strategy Memo",
      content: "## Secret Plan\n\nDo not disclose to external parties under any circumstances.",
      category: "personal",
    };

    const encrypted = await encryptVaultItem(note, vek, userId, itemId);

    // Assert ciphertext and IV are base64 strings
    assert.ok(encrypted.encryptedData.length > 0);
    assert.ok(encrypted.iv.length > 0);
    assert.strictEqual(encrypted.cryptoVersion, 1);

    // Cryptographic leak test: Ensure no plaintext title, secret phrase, or category exists in ciphertext or IV
    const rawCiphertext = Buffer.from(encrypted.encryptedData, "base64").toString("latin1");
    assert.strictEqual(rawCiphertext.includes("Confidential Strategy Memo"), false);
    assert.strictEqual(rawCiphertext.includes("Secret Plan"), false);
    assert.strictEqual(rawCiphertext.includes("external parties"), false);
    assert.strictEqual(rawCiphertext.includes("personal"), false);

    // Decrypt with correct key and AAD
    const decrypted = await decryptVaultItem<SecureNotePayload>(encrypted, vek, userId, itemId);
    assert.strictEqual(decrypted.type, "note");
    assert.strictEqual(decrypted.title, "Confidential Strategy Memo");
    assert.strictEqual(decrypted.content, "## Secret Plan\n\nDo not disclose to external parties under any circumstances.");
    assert.strictEqual(decrypted.category, "personal");
  });

  it("fails note decryption when tampered or wrong key/AAD is supplied", async () => {
    const vek = generateVaultEncryptionKey();
    const wrongVek = generateVaultEncryptionKey();
    const userId = "usr_alice";
    const itemId = "note_123456";

    const note: SecureNotePayload = {
      type: "note",
      title: "Encrypted Recovery Words",
      content: "word1 word2 word3 word4",
    };

    const encrypted = await encryptVaultItem(note, vek, userId, itemId);

    // Wrong VEK
    await assert.rejects(
      async () => decryptVaultItem(encrypted, wrongVek, userId, itemId),
      /operation failed|mac check in gcm failed|decryption/i
    );

    // Wrong User ID in AAD (cross-user isolation)
    await assert.rejects(
      async () => decryptVaultItem(encrypted, vek, "usr_bob_attacker", itemId),
      /operation failed|mac check in gcm failed|decryption/i
    );

    // Wrong Item ID in AAD (cross-item re-binding defense)
    await assert.rejects(
      async () => decryptVaultItem(encrypted, vek, userId, "note_tampered_id"),
      /operation failed|mac check in gcm failed|decryption/i
    );
  });
});

describe("Phase 13.2 — Encrypted .passend Backup Archive Creation & Validation", () => {
  const dummyProfile: PassEndBackupProfile = {
    sourceAccountId: "usr_export_test",
    kdf: {
      algorithm: "Argon2id",
      salt: bytesToBase64(new Uint8Array(16)),
      parameters: {
        version: 1,
        memoryKiB: 19456,
        iterations: 2,
        parallelism: 1,
        hashLength: 32,
      },
    },
    wrappedVaultKey: bytesToBase64(new Uint8Array(48)),
    wrapIv: bytesToBase64(new Uint8Array(12)),
    cryptoVersion: 1,
  };

  const dummyItems: PassEndBackupItem[] = [
    {
      id: "item_001_1122334455667788",
      encryptedData: bytesToBase64(Buffer.from("encrypted-payload-1")),
      iv: bytesToBase64(new Uint8Array(12)),
      cryptoVersion: 1,
      version: 1,
      isFavorite: false,
      isTrash: false,
      trashedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_002_9988776655443322",
      encryptedData: bytesToBase64(Buffer.from("encrypted-payload-2")),
      iv: bytesToBase64(new Uint8Array(12)),
      cryptoVersion: 1,
      version: 2,
      isFavorite: true,
      isTrash: false,
      trashedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("builds a conforming backup package with zero plaintext in manifest", () => {
    const backup = buildBackupPackage(dummyProfile, dummyItems);

    assert.strictEqual(backup.manifest.format, BACKUP_FORMAT);
    assert.strictEqual(backup.manifest.version, BACKUP_VERSION);
    assert.strictEqual(backup.manifest.itemCount, 2);
    assert.ok(backup.manifest.exportedAt);

    // Manifest must not contain item fields
    const manifestKeys = Object.keys(backup.manifest);
    assert.deepStrictEqual(manifestKeys.sort(), ["exportedAt", "format", "itemCount", "version"].sort());

    const json = JSON.stringify(backup);
    assert.ok(json.length > 0);
  });

  it("validates and parses a valid .passend backup file", () => {
    const backup = buildBackupPackage(dummyProfile, dummyItems);
    const text = JSON.stringify(backup);

    const parsed = parseAndValidateBackup(text);
    assert.strictEqual(parsed.manifest.itemCount, 2);
    assert.strictEqual(parsed.items.length, 2);
    assert.strictEqual(parsed.profile.sourceAccountId, "usr_export_test");
  });

  it("strictly rejects malformed, oversized, or tampered backup files", () => {
    // Non-JSON
    assert.throws(
      () => parseAndValidateBackup("not-json-content"),
      /not a valid JSON document/
    );

    // Manifest item count mismatch
    const backup = buildBackupPackage(dummyProfile, dummyItems);
    const tampered = {
      ...backup,
      manifest: {
        ...backup.manifest,
        itemCount: 99, // Mismatched!
      },
    };
    assert.throws(
      () => parseAndValidateBackup(JSON.stringify(tampered)),
      /Manifest item count does not match/
    );

    // Invalid format identifier
    const invalidFormat = {
      ...backup,
      manifest: {
        ...backup.manifest,
        format: "unsupported-format",
      },
    };
    assert.throws(
      () => parseAndValidateBackup(JSON.stringify(invalidFormat)),
      /Backup validation failed/
    );

    // Invalid Base64 in wrapped key
    const invalidKey = {
      ...backup,
      profile: {
        ...backup.profile,
        wrappedVaultKey: "!!!not-valid-base64-###",
      },
    };
    assert.throws(
      () => parseAndValidateBackup(JSON.stringify(invalidKey)),
      /Backup validation failed/
    );
  });
});

describe("Phase 13.2 — End-to-End Vault Restore & Re-encryption Flow", () => {
  it("unwraps source VEK via recovery key, re-encrypts under destination VEK, and handles merge mode", async () => {
    // Source Vault setup
    const sourceVek = generateVaultEncryptionKey();
    const sourceAccountId = "usr_source_alice";
    const rawRecoveryKey = generateRecoveryKey();
    const formattedRecoveryKey = formatRecoveryKey(rawRecoveryKey);

    const recoveryAad = createAdditionalData(sourceAccountId, "recovery-key-wrap", 1);
    const recoveryEnvelope = await wrapVaultKeyWithRecoveryKey(sourceVek, rawRecoveryKey, recoveryAad);

    // Source Items (1 Login, 1 Secure Note)
    const sourceLogin: LoginPayload = {
      type: "login",
      title: "ProtonMail",
      username: "alice@proton.me",
      password: "ProtonPassword123!",
      website: "https://mail.proton.me",
      notes: "Main personal email",
    };
    const sourceNote: SecureNotePayload = {
      type: "note",
      title: "API Keys Backup",
      content: "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
      category: "work",
    };

    const sourceItemId1 = "source_item_001_112233445566";
    const sourceItemId2 = "source_item_002_778899aabbcc";

    const encItem1 = await encryptVaultItem(sourceLogin, sourceVek, sourceAccountId, sourceItemId1);
    const encItem2 = await encryptVaultItem(sourceNote, sourceVek, sourceAccountId, sourceItemId2);

    const backupProfile: PassEndBackupProfile = {
      sourceAccountId,
      kdf: {
        algorithm: "Argon2id",
        salt: bytesToBase64(new Uint8Array(16)),
        parameters: { version: 1, memoryKiB: 19456, iterations: 2, parallelism: 1, hashLength: 32 },
      },
      wrappedVaultKey: bytesToBase64(new Uint8Array(48)),
      wrapIv: bytesToBase64(new Uint8Array(12)),
      cryptoVersion: 1,
      recoveryWrappedVaultKey: recoveryEnvelope.ciphertext,
      recoveryWrapIv: recoveryEnvelope.iv,
      recoveryCryptoVersion: recoveryEnvelope.cryptoVersion,
    };

    const backupItems: PassEndBackupItem[] = [
      {
        id: sourceItemId1,
        encryptedData: encItem1.encryptedData,
        iv: encItem1.iv,
        cryptoVersion: 1,
        version: 1,
        isFavorite: true,
        isTrash: false,
        trashedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: sourceItemId2,
        encryptedData: encItem2.encryptedData,
        iv: encItem2.iv,
        cryptoVersion: 1,
        version: 1,
        isFavorite: false,
        isTrash: false,
        trashedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const backupPackage = buildBackupPackage(backupProfile, backupItems);

    // Destination Vault Setup
    const destinationVek = generateVaultEncryptionKey();
    const destinationAccountId = "usr_destination_bob";

    // Track batch upload calls
    const uploadedBatches: Array<Array<{ id: string; encryptedData: string; iv: string; cryptoVersion: 1 }>> = [];

    // Mock global fetch for batch upload and delete
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/vault/batch")) {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          uploadedBatches.push(body.items);
          return new Response(JSON.stringify({ success: true, count: body.items.length }), { status: 201 });
        }
        if (init?.method === "DELETE") {
          return new Response(JSON.stringify({ success: true, deletedCount: 5 }), { status: 200 });
        }
      }
      return originalFetch(input, init);
    };

    try {
      // 1. Run restore in merge mode where "login:protonmail" already exists
      const existingTitles = new Set<string>(["login:protonmail"]);

      const progressSteps: string[] = [];
      const summary = await restoreEncryptedBackup({
        backup: backupPackage,
        credential: { recoveryKey: formattedRecoveryKey.replace(/-/g, "") },
        destinationVaultKey: destinationVek,
        destinationAccountId,
        existingItemTitles: existingTitles,
        mode: "merge",
        onProgress: (p) => {
          if (p.message) progressSteps.push(p.message);
        },
      });

      // Verify merge summary: 1 duplicate skipped (ProtonMail), 1 imported (API Keys Backup)
      assert.strictEqual(summary.totalInBackup, 2);
      assert.strictEqual(summary.imported, 1);
      assert.strictEqual(summary.duplicatesSkipped, 1);
      assert.strictEqual(summary.mode, "merge");
      assert.strictEqual(uploadedBatches.length, 1);
      assert.strictEqual(uploadedBatches[0].length, 1);

      // Verify the restored item was re-encrypted under destination VEK
      const importedRecord = uploadedBatches[0][0];
      assert.notStrictEqual(importedRecord.id, sourceItemId2); // Fresh random ID assigned

      // Decrypt with destination VEK: must succeed!
      const decryptedNote = await decryptVaultItem<SecureNotePayload>(
        importedRecord,
        destinationVek,
        destinationAccountId,
        importedRecord.id
      );
      assert.strictEqual(decryptedNote.type, "note");
      assert.strictEqual(decryptedNote.title, "API Keys Backup");
      assert.strictEqual(decryptedNote.content, "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE");

      // Verify source VEK CANNOT decrypt the destination record!
      await assert.rejects(
        async () =>
          decryptVaultItem(importedRecord, sourceVek, destinationAccountId, importedRecord.id),
        /operation failed|mac check in gcm failed|decryption/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles replace mode by issuing DELETE before uploading re-encrypted items", async () => {
    const sourceVek = generateVaultEncryptionKey();
    const sourceAccountId = "usr_source_charlie";
    const rawRecoveryKey = generateRecoveryKey();

    const recoveryAad = createAdditionalData(sourceAccountId, "recovery-key-wrap", 1);
    const recoveryEnvelope = await wrapVaultKeyWithRecoveryKey(sourceVek, rawRecoveryKey, recoveryAad);

    const notePayload: SecureNotePayload = {
      type: "note",
      title: "Fresh Note After Replace",
      content: "All previous items replaced.",
    };
    const encItem = await encryptVaultItem(notePayload, sourceVek, sourceAccountId, "source_note_99999");

    const backupProfile: PassEndBackupProfile = {
      sourceAccountId,
      kdf: {
        algorithm: "Argon2id",
        salt: bytesToBase64(new Uint8Array(16)),
        parameters: { version: 1, memoryKiB: 19456, iterations: 2, parallelism: 1, hashLength: 32 },
      },
      wrappedVaultKey: bytesToBase64(new Uint8Array(48)),
      wrapIv: bytesToBase64(new Uint8Array(12)),
      cryptoVersion: 1,
      recoveryWrappedVaultKey: recoveryEnvelope.ciphertext,
      recoveryWrapIv: recoveryEnvelope.iv,
      recoveryCryptoVersion: 1,
    };

    const backupPackage = buildBackupPackage(backupProfile, [
      {
        id: "source_note_99999",
        encryptedData: encItem.encryptedData,
        iv: encItem.iv,
        cryptoVersion: 1,
        version: 1,
        isFavorite: false,
        isTrash: false,
        trashedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const destinationVek = generateVaultEncryptionKey();
    const actions: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/vault/batch")) {
        if (init?.method === "DELETE") {
          actions.push("DELETE_CALLED");
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (init?.method === "POST") {
          actions.push("POST_BATCH_CALLED");
          return new Response(JSON.stringify({ success: true }), { status: 201 });
        }
      }
      return originalFetch(input, init);
    };

    try {
      const summary = await restoreEncryptedBackup({
        backup: backupPackage,
        credential: { recoveryKey: bytesToHex(rawRecoveryKey) },
        destinationVaultKey: destinationVek,
        destinationAccountId: "usr_destination_charlie",
        mode: "replace",
      });

      assert.strictEqual(summary.mode, "replace");
      assert.strictEqual(summary.imported, 1);
      assert.deepStrictEqual(actions, ["DELETE_CALLED", "POST_BATCH_CALLED"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Phase 13.2 — Batch Vault API Schema Validation", () => {
  it("accepts valid batch item arrays up to 50 items", () => {
    const validBatch = {
      items: [
        {
          id: "item_0123456789abcdef",
          encryptedData: bytesToBase64(Buffer.from("encrypted-record")),
          iv: bytesToBase64(new Uint8Array(12)),
          cryptoVersion: 1,
          isFavorite: false,
        },
      ],
    };

    const result = batchCreateVaultItemSchema.safeParse(validBatch);
    assert.strictEqual(result.success, true);
  });

  it("rejects batches exceeding maximum batch size or with invalid fields", () => {
    // Empty array rejected
    assert.strictEqual(batchCreateVaultItemSchema.safeParse({ items: [] }).success, false);

    // Over 50 items rejected
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      id: `item_batch_${String(i).padStart(16, "0")}`,
      encryptedData: bytesToBase64(Buffer.from("data")),
      iv: bytesToBase64(new Uint8Array(12)),
      cryptoVersion: 1,
      isFavorite: false,
    }));
    assert.strictEqual(batchCreateVaultItemSchema.safeParse({ items: tooMany }).success, false);

    // Invalid IV (must be 12 bytes = 16 base64 chars)
    const invalidIv = {
      items: [
        {
          id: "item_0123456789abcdef",
          encryptedData: bytesToBase64(Buffer.from("encrypted-record")),
          iv: "not-12-bytes",
          cryptoVersion: 1,
          isFavorite: false,
        },
      ],
    };
    assert.strictEqual(batchCreateVaultItemSchema.safeParse(invalidIv).success, false);
  });
});

describe("Phase 13 — Recovery Key Regeneration & Invalidation", () => {
  it("regenerates recovery envelope and invalidates the previous recovery key", async () => {
    const vek = generateVaultEncryptionKey();
    const userId = "usr_regen_test";

    // 1. Initial recovery key
    const oldRecoveryKey = generateRecoveryKey();
    const oldAad = createAdditionalData(userId, "recovery-key-wrap", 1);
    const oldEnvelope = await wrapVaultKeyWithRecoveryKey(vek, oldRecoveryKey, oldAad);

    // Verify old key unwraps VEK
    const unwrappedWithOld = await unwrapVaultKeyWithRecoveryKey(oldEnvelope, oldRecoveryKey, oldAad);
    assert.deepStrictEqual(unwrappedWithOld, vek);

    // 2. Regenerate recovery key
    const newRecoveryKey = generateRecoveryKey();
    const newAad = createAdditionalData(userId, "recovery-key-wrap", 1);
    const newEnvelope = await wrapVaultKeyWithRecoveryKey(vek, newRecoveryKey, newAad);

    // Verify new key unwraps VEK
    const unwrappedWithNew = await unwrapVaultKeyWithRecoveryKey(newEnvelope, newRecoveryKey, newAad);
    assert.deepStrictEqual(unwrappedWithNew, vek);

    // 3. Cryptographic Invalidation: The old recovery key MUST fail against the new envelope!
    await assert.rejects(
      async () => unwrapVaultKeyWithRecoveryKey(newEnvelope, oldRecoveryKey, newAad),
      /operation failed|mac check in gcm failed|decryption/i
    );
  });
});
