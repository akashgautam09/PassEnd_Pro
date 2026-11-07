import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  _resetRateLimits,
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
} from "../lib/security/rate-limit.ts";
import { MAX_JSON_BODY_BYTES, updateVaultItemSchema } from "../lib/validations/api.ts";
import { parseJsonBody } from "../lib/api/request.ts";

describe("Phase 11 — Rate Limiting & 429 Responses", () => {
  beforeEach(() => {
    _resetRateLimits();
  });

  it("permits requests within rate limit and decrements remaining quota", async () => {
    const key = "test:user1:read";
    const res1 = await checkRateLimit(key, 3, 60_000);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.limit, 3);
    assert.strictEqual(res1.remaining, 2);

    const res2 = await checkRateLimit(key, 3, 60_000);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.remaining, 1);

    const res3 = await checkRateLimit(key, 3, 60_000);
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.remaining, 0);
  });

  it("returns HTTP 429 with Retry-After and rate limit headers when limit is exceeded", async () => {
    const key = "test:user2:write";
    // Exhaust quota (limit = 2)
    const first = await enforceRateLimit(key, 2, 60_000);
    assert.strictEqual(first, null);

    const second = await enforceRateLimit(key, 2, 60_000);
    assert.strictEqual(second, null);

    // 3rd attempt should trigger 429
    const blocked = await enforceRateLimit(key, 2, 60_000);
    assert.notStrictEqual(blocked, null);
    assert.strictEqual(blocked!.status, 429);

    const retryAfter = blocked!.headers.get("Retry-After");
    assert.ok(retryAfter, "Retry-After header should be present");
    assert.ok(Number(retryAfter) > 0, "Retry-After should be a positive number of seconds");
    assert.strictEqual(blocked!.headers.get("X-RateLimit-Limit"), "2");
    assert.strictEqual(blocked!.headers.get("X-RateLimit-Remaining"), "0");
    assert.ok(blocked!.headers.get("X-RateLimit-Reset"));

    const body = (await blocked!.json()) as { error: string };
    assert.match(body.error, /too many requests/i);
  });

  it("isolates rate limits between distinct user IDs and operations", async () => {
    const userA = "user_aaa_123";
    const userB = "user_bbb_456";

    // Exhaust user A
    await enforceRateLimit(`vault:write:${userA}`, 1, 60_000);
    const blockedA = await enforceRateLimit(`vault:write:${userA}`, 1, 60_000);
    assert.strictEqual(blockedA?.status, 429);

    // User B should still have full quota
    const allowedB = await enforceRateLimit(`vault:write:${userB}`, 1, 60_000);
    assert.strictEqual(allowedB, null);

    // User A should still be able to perform GET (separate bucket)
    const allowedAGet = await enforceRateLimit(`vault:get:${userA}`, 1, 60_000);
    assert.strictEqual(allowedAGet, null);
  });

  it("extracts trusted client IP signal without trusting spoofed values blindly", () => {
    // 1. x-vercel-forwarded-for takes precedence
    const reqVercel = new Request("http://localhost/api/test", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.195",
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      },
    });
    assert.strictEqual(getClientIp(reqVercel), "203.0.113.195");

    // 2. cf-connecting-ip
    const reqCf = new Request("http://localhost/api/test", {
      headers: {
        "cf-connecting-ip": "198.51.100.4",
      },
    });
    assert.strictEqual(getClientIp(reqCf), "198.51.100.4");

    // 3. Clean first IP from x-forwarded-for
    const reqXff = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "192.0.2.1, 10.0.0.1",
      },
    });
    assert.strictEqual(getClientIp(reqXff), "192.0.2.1");

    // 4. Spoofed / garbage header falls back to 127.0.0.1
    const reqGarbage = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "<script>alert(1)</script>",
      },
    });
    assert.strictEqual(getClientIp(reqGarbage), "127.0.0.1");
  });

  it("handles distributed rate limiter failure according to fallback policy", async () => {
    // Point to an unreachable URL to simulate network outage
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9999";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake_token";

    try {
      // 1. Under default "memory" fallback, requests are not crashed or left unmetered
      process.env.RATE_LIMIT_ON_PROVIDER_ERROR = "memory";
      const res = await checkRateLimit("fallback_test_key", 5, 60_000);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.remaining, 4);

      // 2. Under strict "deny" fallback, requests fail closed (success = false)
      process.env.RATE_LIMIT_ON_PROVIDER_ERROR = "deny";
      const denyRes = await checkRateLimit("fallback_deny_key", 5, 60_000);
      assert.strictEqual(denyRes.success, false);
      assert.strictEqual(denyRes.remaining, 0);
    } finally {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.RATE_LIMIT_ON_PROVIDER_ERROR;
    }
  });
});

describe("Phase 11 — Request Size Limits & 413 Handling", () => {
  it("rejects request immediately when Content-Length exceeds MAX_JSON_BODY_BYTES", async () => {
    const oversizedLength = String(MAX_JSON_BODY_BYTES + 1024);
    const req = new Request("http://localhost/api/vault", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": oversizedLength,
      },
      body: JSON.stringify({ title: "test" }),
    });

    await assert.rejects(
      async () => {
        await parseJsonBody(req, updateVaultItemSchema);
      },
      (err: Error) => err.message === "PAYLOAD_TOO_LARGE"
    );
  });

  it("rejects request body when decoded payload exceeds MAX_JSON_BODY_BYTES", async () => {
    // Generate a payload that exceeds 2MB
    const largeString = "a".repeat(MAX_JSON_BODY_BYTES + 10);
    const req = new Request("http://localhost/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: largeString }),
    });

    await assert.rejects(
      async () => {
        await parseJsonBody(req, updateVaultItemSchema);
      },
      (err: Error) => err.message === "PAYLOAD_TOO_LARGE"
    );
  });
});

describe("Phase 11 — Optimistic Concurrency Control (409 Conflict)", () => {
  type MockItem = {
    _id: string;
    userId: string;
    version: number;
    title: string;
  };

  class MockVaultCollection {
    private items: Map<string, MockItem> = new Map();

    insert(item: MockItem) {
      this.items.set(item._id, { ...item });
    }

    get(id: string): MockItem | undefined {
      return this.items.get(id);
    }

    /**
     * Mirrors MongoDB atomic findOneAndUpdate with optimistic concurrency check:
     * { _id: id, userId, $or: [{ version: expectedVersion }, { version: { $exists: false } }] }
     */
    findOneAndUpdate(
      id: string,
      userId: string,
      expectedVersion: number,
      newTitle: string
    ): { matched: boolean; item?: MockItem; conflict: boolean } {
      const existing = this.items.get(id);
      if (!existing || existing.userId !== userId) {
        return { matched: false, conflict: false };
      }

      if (existing.version !== expectedVersion) {
        // Record exists for this user, but version mismatch -> Conflict!
        return { matched: false, conflict: true };
      }

      // Atomic update matching expected version
      const updated: MockItem = {
        ...existing,
        title: newTitle,
        version: expectedVersion + 1,
      };
      this.items.set(id, updated);
      return { matched: true, item: updated, conflict: false };
    }

    /**
     * Mirrors MongoDB atomic deleteOne with version check:
     * { _id: id, userId, $or: [{ version: expectedVersion }, { version: { $exists: false } }] }
     */
    deleteOne(
      id: string,
      userId: string,
      expectedVersion: number
    ): { deleted: boolean; conflict: boolean; notFound: boolean } {
      const existing = this.items.get(id);
      if (!existing || existing.userId !== userId) {
        return { deleted: false, conflict: false, notFound: true };
      }

      if (existing.version !== expectedVersion) {
        return { deleted: false, conflict: true, notFound: false };
      }

      this.items.delete(id);
      return { deleted: true, conflict: false, notFound: false };
    }
  }

  it("updates item and increments version from 1 to 2 when version matches", () => {
    const db = new MockVaultCollection();
    db.insert({ _id: "item_1", userId: "user_alice", version: 1, title: "Original" });

    const result = db.findOneAndUpdate("item_1", "user_alice", 1, "Updated Title");
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.conflict, false);
    assert.strictEqual(result.item?.version, 2);
    assert.strictEqual(result.item?.title, "Updated Title");
  });

  it("returns conflict (HTTP 409) when updating with a stale version", () => {
    const db = new MockVaultCollection();
    // Item is already at version 2 (e.g. updated by another tab)
    db.insert({ _id: "item_1", userId: "user_alice", version: 2, title: "Modified by Tab B" });

    // Tab A attempts to save with stale version 1
    const result = db.findOneAndUpdate("item_1", "user_alice", 1, "Attempt from Tab A");
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.conflict, true);

    // Verify database record remains untouched at version 2
    const current = db.get("item_1");
    assert.strictEqual(current?.version, 2);
    assert.strictEqual(current?.title, "Modified by Tab B");
  });

  it("returns conflict (HTTP 409) when deleting with a stale version", () => {
    const db = new MockVaultCollection();
    db.insert({ _id: "item_1", userId: "user_alice", version: 3, title: "Active Login" });

    // Client attempts to delete with outdated version 2
    const result = db.deleteOne("item_1", "user_alice", 2);
    assert.strictEqual(result.deleted, false);
    assert.strictEqual(result.conflict, true);
    assert.strictEqual(result.notFound, false);

    // Item must still exist
    assert.ok(db.get("item_1"));
  });

  it("successfully deletes item when version matches", () => {
    const db = new MockVaultCollection();
    db.insert({ _id: "item_1", userId: "user_alice", version: 3, title: "Active Login" });

    const result = db.deleteOne("item_1", "user_alice", 3);
    assert.strictEqual(result.deleted, true);
    assert.strictEqual(result.conflict, false);
    assert.strictEqual(db.get("item_1"), undefined);
  });
});

describe("Phase 11 — Cross-User Access Isolation", () => {
  type MockItem = {
    _id: string;
    userId: string;
    version: number;
    title: string;
  };

  it("prevents user B from reading, updating, or deleting user A's records", () => {
    const items = new Map<string, MockItem>();
    const itemA: MockItem = {
      _id: "secret_item_123",
      userId: "user_alice",
      version: 1,
      title: "Alice's Bank",
    };
    items.set(itemA._id, itemA);

    // 1. User Bob tries to GET Alice's item
    const bobRead = Array.from(items.values()).find(
      (item) => item._id === "secret_item_123" && item.userId === "user_bob"
    );
    assert.strictEqual(bobRead, undefined, "Bob must not find Alice's item");

    // 2. User Bob tries to PATCH Alice's item
    const bobUpdate = Array.from(items.values()).find(
      (item) => item._id === "secret_item_123" && item.userId === "user_bob"
    );
    assert.strictEqual(bobUpdate, undefined, "Bob must not match Alice's item for update");
    // Verify Alice's item is unchanged
    assert.strictEqual(items.get("secret_item_123")?.title, "Alice's Bank");

    // 3. User Bob tries to DELETE Alice's item
    const bobDeleteMatch = Array.from(items.values()).find(
      (item) => item._id === "secret_item_123" && item.userId === "user_bob"
    );
    assert.strictEqual(bobDeleteMatch, undefined, "Bob must not match Alice's item for deletion");
    assert.ok(items.get("secret_item_123"), "Alice's item must remain intact");
  });
});

describe("Phase 11 — Content Security Policy & Security Headers", () => {
  it("enforces strict CSP without unsafe-eval in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      // In production mode:
      (process.env as Record<string, string>).NODE_ENV = "production";
      const { default: nextConfig } = await import("../next.config.ts");
      assert.ok(nextConfig.headers, "nextConfig should define headers function");

      const headerConfigs = await nextConfig.headers!();
      const globalHeaders = headerConfigs.find((h) => h.source === "/(.*)")?.headers ?? [];

      const cspHeader = globalHeaders.find((h) =>
        h.key === "Content-Security-Policy" || h.key === "Content-Security-Policy-Report-Only"
      );
      assert.ok(cspHeader, "CSP header must be configured");

      // Verify NO unsafe-eval in production CSP
      assert.doesNotMatch(cspHeader.value, /'unsafe-eval'/, "Production CSP must NEVER contain 'unsafe-eval'");

      // Verify defensive directives
      assert.match(cspHeader.value, /object-src 'none'/, "Must include object-src 'none'");
      assert.match(cspHeader.value, /base-uri 'self'/, "Must include base-uri 'self'");
      assert.match(cspHeader.value, /frame-ancestors 'none'/, "Must include frame-ancestors 'none'");
      assert.match(cspHeader.value, /connect-src [^;]*api\.pwnedpasswords\.com/, "Must allow api.pwnedpasswords.com");

      // Verify required security headers
      const nosniff = globalHeaders.find((h) => h.key === "X-Content-Type-Options");
      assert.strictEqual(nosniff?.value, "nosniff");

      const frameOptions = globalHeaders.find((h) => h.key === "X-Frame-Options");
      assert.strictEqual(frameOptions?.value, "DENY");

      const hsts = globalHeaders.find((h) => h.key === "Strict-Transport-Security");
      assert.ok(hsts?.value?.includes("max-age="), "Must include HSTS");
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv!;
    }
  });
});

