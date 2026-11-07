import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  base32ToBytes,
  bytesToBase32,
  formatTotpDisplay,
  generateTotpCode,
  getTotpTimeRemaining,
  parseTotpUri,
} from "../lib/crypto/totp.ts";
import { validateChannelMessage } from "../lib/sync/tab-channel.ts";

describe("Phase 12 — RFC 6238 TOTP Official Test Vectors", () => {
  // RFC 6238 Appendix B test secrets
  // SHA1 secret: 20 bytes "12345678901234567890" -> Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const sha1SecretBase32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  // RFC 6238 Appendix B Table 1 test vectors (SHA-1, 8 digits):
  // Time 59s:         "94287082"
  // Time 1111111109s: "07081804"
  // Time 1111111111s: "14050471"
  // Time 1234567890s: "89005924"
  // Time 2000000000s: "69279037"

  it("matches RFC 6238 Appendix B Table 1 (SHA-1, 8 digits)", async () => {
    const vectors = [
      { timeSec: 59, expected: "94287082" },
      { timeSec: 1111111109, expected: "07081804" },
      { timeSec: 1111111111, expected: "14050471" },
      { timeSec: 1234567890, expected: "89005924" },
      { timeSec: 2000000000, expected: "69279037" },
    ];

    for (const { timeSec, expected } of vectors) {
      const code = await generateTotpCode(
        { secret: sha1SecretBase32, algorithm: "SHA-1", digits: 8, period: 30 },
        timeSec * 1000
      );
      assert.strictEqual(code, expected, `Failed for time ${timeSec}`);
    }
  });

  it("matches RFC 6238 test vectors truncated to 6 digits", async () => {
    // 6-digit versions of RFC test vectors:
    const vectors = [
      { timeSec: 59, expected: "287082" },
      { timeSec: 1111111109, expected: "081804" },
      { timeSec: 1111111111, expected: "050471" },
      { timeSec: 1234567890, expected: "005924" }, // Verifies leading zeros
      { timeSec: 2000000000, expected: "279037" },
    ];

    for (const { timeSec, expected } of vectors) {
      const code = await generateTotpCode(
        { secret: sha1SecretBase32, algorithm: "SHA-1", digits: 6, period: 30 },
        timeSec * 1000
      );
      assert.strictEqual(code, expected, `Failed for time ${timeSec}`);
    }
  });

  it("matches RFC 6238 Appendix B Table 1 (SHA-256, 8 digits)", async () => {
    // 32-byte secret ASCII "12345678901234567890123456789012"
    const sha256SecretBase32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA";

    const vectors = [
      { timeSec: 59, expected: "46119246" },
      { timeSec: 1111111109, expected: "68084774" },
      { timeSec: 1111111111, expected: "67062674" },
      { timeSec: 1234567890, expected: "91819424" },
      { timeSec: 2000000000, expected: "90698825" },
    ];

    for (const { timeSec, expected } of vectors) {
      const code = await generateTotpCode(
        { secret: sha256SecretBase32, algorithm: "SHA-256", digits: 8, period: 30 },
        timeSec * 1000
      );
      assert.strictEqual(code, expected, `Failed for SHA-256 time ${timeSec}`);
    }
  });

  it("handles timestamps beyond 32-bit signed Unix integer boundary safely", async () => {
    // Timestamp beyond 2^31 - 1 (year 2038 / 2147483647 seconds):
    const farFutureSeconds = 3000000000; // year 2065
    const code = await generateTotpCode(
      { secret: sha1SecretBase32, algorithm: "SHA-1", digits: 6, period: 30 },
      farFutureSeconds * 1000
    );
    assert.strictEqual(code.length, 6);
    assert.match(code, /^\d{6}$/);
  });
});

describe("Phase 12 — Base32 Encoding & Decoding", () => {
  it("encodes and decodes Base32 round-trip", () => {
    const raw = new TextEncoder().encode("Hello PassEnd Pro!");
    const base32 = bytesToBase32(raw);
    const decoded = base32ToBytes(base32);
    assert.deepStrictEqual(decoded, raw);
  });

  it("ignores whitespace, hyphens, and padding in Base32 input", () => {
    const clean = base32ToBytes("JBSWY3DPEHPK3PXP");
    const withHyphens = base32ToBytes("jbsw-y3dp-ehpk-3pxp");
    const withSpaces = base32ToBytes("  JBSW Y3DP EHPK 3PXP==  ");
    assert.deepStrictEqual(withHyphens, clean);
    assert.deepStrictEqual(withSpaces, clean);
  });

  it("throws descriptive error on invalid Base32 characters", () => {
    assert.throws(
      () => base32ToBytes("INVALID_890!"),
      /Invalid Base32 character/
    );
  });
});

describe("Phase 12 — TOTP URI Parsing & Formatting", () => {
  it("parses standard Google Authenticator otpauth URI", () => {
    const uri = "otpauth://totp/Google:alice%40gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google";
    const config = parseTotpUri(uri);
    assert.strictEqual(config.secret, "JBSWY3DPEHPK3PXP");
    assert.strictEqual(config.issuer, "Google");
    assert.strictEqual(config.account, "alice@gmail.com");
    assert.strictEqual(config.digits, 6);
    assert.strictEqual(config.period, 30);
    assert.strictEqual(config.algorithm, "SHA-1");
  });

  it("parses custom algorithm, digits, and period parameters", () => {
    const uri = "otpauth://totp/CustomService?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&algorithm=SHA256&digits=8&period=60";
    const config = parseTotpUri(uri);
    assert.strictEqual(config.algorithm, "SHA-256");
    assert.strictEqual(config.digits, 8);
    assert.strictEqual(config.period, 60);
  });

  it("rejects invalid or non-totp schemes", () => {
    assert.throws(() => parseTotpUri("https://example.com/qr.png"), /Invalid TOTP URI/);
    assert.throws(() => parseTotpUri("otpauth://hotp/test?secret=JBSWY3DPEHPK3PXP"), /Invalid TOTP URI/);
    assert.throws(() => parseTotpUri("otpauth://totp/test"), /Missing 'secret'/);
  });

  it("formats TOTP codes with human-readable space grouping", () => {
    assert.strictEqual(formatTotpDisplay("123456"), "123 456");
    assert.strictEqual(formatTotpDisplay("12345678"), "1234 5678");
  });

  it("calculates time remaining accurately within time step", () => {
    const now = 1000 * 45; // 45 seconds elapsed, period 30s -> 15s elapsed in step, 15s remaining
    const info = getTotpTimeRemaining(30, now);
    assert.strictEqual(info.remainingSeconds, 15);
    assert.strictEqual(info.percentage, 50);
  });
});

describe("Phase 12 — Cross-Tab BroadcastChannel Coordination Safety", () => {
  it("validates safe broadcast message shapes", () => {
    const lockMsg = validateChannelMessage({
      type: "VAULT_LOCKED",
      sourceTabId: "tab_123",
      timestamp: Date.now(),
    });
    assert.ok(lockMsg);
    assert.strictEqual(lockMsg?.type, "VAULT_LOCKED");

    const mutateMsg = validateChannelMessage({
      type: "VAULT_MUTATED",
      sourceTabId: "tab_456",
      timestamp: Date.now(),
      itemId: "item_abc",
      action: "updated",
    });
    assert.ok(mutateMsg);
    assert.strictEqual(mutateMsg?.type, "VAULT_MUTATED");
  });

  it("strictly rejects any message attempting to leak secrets or keys across tabs", () => {
    const maliciousMsg = {
      type: "VAULT_MUTATED",
      sourceTabId: "tab_bad",
      timestamp: Date.now(),
      password: "secret_password_leak",
    };
    assert.strictEqual(validateChannelMessage(maliciousMsg), null);

    const keyLeakMsg = {
      type: "VAULT_LOCKED",
      sourceTabId: "tab_bad",
      timestamp: Date.now(),
      vaultKey: "leak_raw_key",
    };
    assert.strictEqual(validateChannelMessage(keyLeakMsg), null);
  });

  it("rejects unknown event types or malformed payloads", () => {
    assert.strictEqual(validateChannelMessage({ type: "UNKNOWN_EVENT" }), null);
    assert.strictEqual(validateChannelMessage("string-message"), null);
    assert.strictEqual(validateChannelMessage(null), null);
  });
});
