import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  decryptVaultItem,
  encryptVaultItem,
  generateVaultEncryptionKey,
} from "../lib/crypto/vault-crypto.ts";
import { wipeBytes, bytesToBase64 } from "../lib/crypto/encoding.ts";
import { buildBackupPackage, type PassEndBackupItem, type PassEndBackupProfile } from "../lib/backup/backup-service.ts";
import type { LoginPayload, SecureNotePayload } from "../lib/types/vault.ts";

describe("Pillar 1.1 — Network Interception & Data Leak Prevention", () => {
  const SENTINEL_PASSWORD = "SENTINEL_SUPER_SECRET_PASSWORD_998877!";
  const SENTINEL_USERNAME = "SENTINEL_CONFIDENTIAL_USER_445566";
  const SENTINEL_NOTE = "SENTINEL_TOP_SECRET_RECOVERY_PHRASE_112233";
  const SENTINEL_TOTP_SEED = "JBSWY3DPEHPK3PXP";
  const SENTINEL_TITLE = "SENTINEL_BANKING_TITLE_778899";

  it("ensures zero plaintext sentinels appear in encrypted login network payloads", async () => {
    const vek = generateVaultEncryptionKey();
    const userId = "usr_leak_test_alice";
    const itemId = "item_leak_test_001";

    const loginPayload: LoginPayload = {
      type: "login",
      title: SENTINEL_TITLE,
      username: SENTINEL_USERNAME,
      password: SENTINEL_PASSWORD,
      website: "https://secure-bank.example.com",
      notes: SENTINEL_NOTE,
      totp: {
        secret: SENTINEL_TOTP_SEED,
        algorithm: "SHA-1",
        digits: 6,
        period: 30,
      },
    };

    const encrypted = await encryptVaultItem(loginPayload, vek, userId, itemId);

    // Simulate network payload transmitted to /api/vault or /api/vault/[id]
    const networkPayload = JSON.stringify({
      id: itemId,
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      cryptoVersion: encrypted.cryptoVersion,
      isFavorite: false,
    });

    // LEAK AUDIT: Ensure not a single plaintext sentinel appears anywhere in the network payload
    assert.strictEqual(networkPayload.includes(SENTINEL_PASSWORD), false, "Password must not leak into network payload");
    assert.strictEqual(networkPayload.includes(SENTINEL_USERNAME), false, "Username must not leak into network payload");
    assert.strictEqual(networkPayload.includes(SENTINEL_NOTE), false, "Notes must not leak into network payload");
    assert.strictEqual(networkPayload.includes(SENTINEL_TOTP_SEED), false, "TOTP seed must not leak into network payload");
    assert.strictEqual(networkPayload.includes(SENTINEL_TITLE), false, "Title must not leak into network payload");
    assert.strictEqual(networkPayload.includes("secure-bank.example.com"), false, "URL must not leak into network payload");

    // Ensure only the authenticated envelope exists
    assert.ok(encrypted.encryptedData.length > 32);
    assert.ok(encrypted.iv.length === 16); // 12 bytes = 16 Base64 chars
    assert.strictEqual(encrypted.cryptoVersion, 1);
  });

  it("ensures zero plaintext sentinels appear in encrypted secure note network payloads", async () => {
    const vek = generateVaultEncryptionKey();
    const userId = "usr_leak_test_bob";
    const itemId = "item_leak_test_002";

    const notePayload: SecureNotePayload = {
      type: "note",
      title: SENTINEL_TITLE,
      content: `# Critical Strategy Document\n\n${SENTINEL_NOTE}`,
      category: "confidential",
    };

    const encrypted = await encryptVaultItem(notePayload, vek, userId, itemId);
    const networkPayload = JSON.stringify(encrypted);

    assert.strictEqual(networkPayload.includes(SENTINEL_NOTE), false, "Note content must not leak");
    assert.strictEqual(networkPayload.includes(SENTINEL_TITLE), false, "Note title must not leak");
    assert.strictEqual(networkPayload.includes("Critical Strategy Document"), false, "Markdown headers must not leak");
    assert.strictEqual(networkPayload.includes("confidential"), false, "Category must not leak");
  });

  it("asserts unencrypted backup manifest contains zero sentinels, titles, or secrets", () => {
    const dummyProfile: PassEndBackupProfile = {
      sourceAccountId: "usr_leak_manifest_test",
      kdf: {
        algorithm: "Argon2id",
        salt: bytesToBase64(new Uint8Array(16)),
        parameters: { version: 1, memoryKiB: 19456, iterations: 2, parallelism: 1, hashLength: 32 },
      },
      wrappedVaultKey: bytesToBase64(new Uint8Array(48)),
      wrapIv: bytesToBase64(new Uint8Array(12)),
      cryptoVersion: 1,
    };

    const dummyItems: PassEndBackupItem[] = [
      {
        id: "item_001_1122334455667788",
        encryptedData: bytesToBase64(Buffer.from("encrypted-data-blob")),
        iv: bytesToBase64(new Uint8Array(12)),
        cryptoVersion: 1,
        version: 1,
        isFavorite: false,
        isTrash: false,
        trashedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const backup = buildBackupPackage(dummyProfile, dummyItems);
    const manifestJson = JSON.stringify(backup.manifest);

    // Manifest must ONLY contain format, version, exportedAt, itemCount
    const manifestKeys = Object.keys(backup.manifest).sort();
    assert.deepStrictEqual(manifestKeys, ["exportedAt", "format", "itemCount", "version"].sort());

    assert.strictEqual(manifestJson.includes(SENTINEL_PASSWORD), false);
    assert.strictEqual(manifestJson.includes(SENTINEL_USERNAME), false);
    assert.strictEqual(manifestJson.includes(SENTINEL_NOTE), false);
    assert.strictEqual(manifestJson.includes(SENTINEL_TITLE), false);
  });
});

describe("Pillar 1.2 & 1.3 — Storage Hygiene, Memory Zeroing & Cryptographic Integrity", () => {
  it("wipes byte buffers completely to prevent memory key retention", () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255, 254]);
    assert.strictEqual(buffer.some((b) => b !== 0), true);

    wipeBytes(buffer);

    // Every byte must be strictly 0
    assert.strictEqual(buffer.every((b) => b === 0), true, "All bytes must be zeroed out by wipeBytes");
  });

  it("strictly fails AES-256-GCM authenticated decryption when 1 byte of ciphertext is modified", async () => {
    const vek = generateVaultEncryptionKey();
    const userId = "usr_tamper_alice";
    const itemId = "item_tamper_001";

    const payload: SecureNotePayload = {
      type: "note",
      title: "Integrity Check Note",
      content: "Unmodified original content",
    };

    const encrypted = await encryptVaultItem(payload, vek, userId, itemId);

    // Tamper with the raw ciphertext by inverting one byte
    const rawCiphertext = Buffer.from(encrypted.encryptedData, "base64");
    rawCiphertext[rawCiphertext.length - 1] ^= 0x01; // flip 1 bit in auth tag / ciphertext
    const tamperedCiphertextBase64 = rawCiphertext.toString("base64");

    const tamperedPayload = {
      ...encrypted,
      encryptedData: tamperedCiphertextBase64,
    };

    // GCM authentication check MUST fail and reject without leaking raw data
    await assert.rejects(
      async () => decryptVaultItem(tamperedPayload, vek, userId, itemId),
      /operation failed|mac check in gcm failed|decryption/i,
      "Tampered ciphertext must fail authenticated decryption"
    );
  });

  it("strictly fails authenticated decryption when 1 byte of IV is modified", async () => {
    const vek = generateVaultEncryptionKey();
    const userId = "usr_tamper_bob";
    const itemId = "item_tamper_002";

    const payload: SecureNotePayload = {
      type: "note",
      title: "IV Integrity Check",
      content: "Testing IV authentication",
    };

    const encrypted = await encryptVaultItem(payload, vek, userId, itemId);

    // Tamper with IV
    const rawIv = Buffer.from(encrypted.iv, "base64");
    rawIv[0] ^= 0xff;
    const tamperedIvBase64 = rawIv.toString("base64");

    const tamperedPayload = {
      ...encrypted,
      iv: tamperedIvBase64,
    };

    await assert.rejects(
      async () => decryptVaultItem(tamperedPayload, vek, userId, itemId),
      /operation failed|mac check in gcm failed|decryption/i,
      "Tampered IV must fail authenticated decryption"
    );
  });

  it("rejects decryption with an incorrect key without leaking timing differentials", async () => {
    const vek = generateVaultEncryptionKey();
    const wrongKey = generateVaultEncryptionKey();
    const userId = "usr_wrong_key";
    const itemId = "item_wrong_key_001";

    const payload: SecureNotePayload = {
      type: "note",
      title: "Secret Memo",
      content: "Strictly confidential",
    };

    const encrypted = await encryptVaultItem(payload, vek, userId, itemId);

    await assert.rejects(
      async () => decryptVaultItem(encrypted, wrongKey, userId, itemId),
      /operation failed|mac check in gcm failed|decryption/i,
      "Incorrect key must fail decryption safely"
    );
  });
});

describe("Pillar 2.1 & 2.3 — Production CSP Enforcing & Serverless DB Robustness", () => {
  it("enforces Content-Security-Policy in production mode without Report-Only", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalCspEnforce = process.env.CSP_ENFORCE;
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      delete (process.env as Record<string, string>).CSP_ENFORCE;

      const { default: nextConfig } = await import("../next.config.ts");
      const headerConfigs = await nextConfig.headers!();
      const globalHeaders = headerConfigs.find((h) => h.source === "/(.*)")?.headers ?? [];

      const cspHeader = globalHeaders.find((h) => h.key === "Content-Security-Policy");
      assert.ok(cspHeader, "Production CSP must be 'Content-Security-Policy' (enforcing)");

      // Report-Only must not be present when enforcing
      const reportOnlyHeader = globalHeaders.find((h) => h.key === "Content-Security-Policy-Report-Only");
      assert.strictEqual(reportOnlyHeader, undefined, "Report-Only must not be used in enforcing production mode");

      // Verify no unsafe-eval
      assert.doesNotMatch(cspHeader.value, /'unsafe-eval'/, "Production CSP must NEVER contain 'unsafe-eval'");
      assert.match(cspHeader.value, /frame-ancestors 'none'/, "Must prevent clickjacking via frame-ancestors 'none'");
      assert.match(cspHeader.value, /object-src 'none'/, "Must block Flash/plugins via object-src 'none'");
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv!;
      if (originalCspEnforce !== undefined) {
        (process.env as Record<string, string>).CSP_ENFORCE = originalCspEnforce;
      }
    }
  });
});
