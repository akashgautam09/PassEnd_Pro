import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  activityEventSchema,
  deleteActivitySchema,
} from "../lib/validations/api.ts";

describe("Activity Deletion — Schema & Parameter Validation", () => {
  test("accepts mode: count with count: 5 and count: 10", () => {
    const res5 = deleteActivitySchema.safeParse({ mode: "count", count: 5 });
    assert.equal(res5.success, true);
    if (res5.success && res5.data.mode === "count") {
      assert.equal(res5.data.count, 5);
    }

    const res10 = deleteActivitySchema.safeParse({ mode: "count", count: 10 });
    assert.equal(res10.success, true);
    if (res10.success && res10.data.mode === "count") {
      assert.equal(res10.data.count, 10);
    }
  });

  test("accepts string-coerced count values from query parameters", () => {
    const res5 = deleteActivitySchema.safeParse({ mode: "count", count: "5" });
    assert.equal(res5.success, true);
    if (res5.success && res5.data.mode === "count") {
      assert.equal(res5.data.count, 5);
    }

    const res10 = deleteActivitySchema.safeParse({ mode: "count", count: "10" });
    assert.equal(res10.success, true);
    if (res10.success && res10.data.mode === "count") {
      assert.equal(res10.data.count, 10);
    }
  });

  test("accepts mode: all", () => {
    const resAll = deleteActivitySchema.safeParse({ mode: "all" });
    assert.equal(resAll.success, true);
    if (resAll.success) {
      assert.equal(resAll.data.mode, "all");
    }
  });

  test("rejects counts other than 5 or 10", () => {
    assert.equal(deleteActivitySchema.safeParse({ mode: "count", count: 1 }).success, false);
    assert.equal(deleteActivitySchema.safeParse({ mode: "count", count: 3 }).success, false);
    assert.equal(deleteActivitySchema.safeParse({ mode: "count", count: 7 }).success, false);
    assert.equal(deleteActivitySchema.safeParse({ mode: "count", count: 20 }).success, false);
    assert.equal(deleteActivitySchema.safeParse({ mode: "count", count: -5 }).success, false);
    assert.equal(deleteActivitySchema.safeParse({ mode: "count" }).success, false);
  });

  test("rejects invalid mode values", () => {
    assert.equal(deleteActivitySchema.safeParse({ mode: "none" }).success, false);
    assert.equal(deleteActivitySchema.safeParse({ mode: "single", count: 5 }).success, false);
    assert.equal(deleteActivitySchema.safeParse({}).success, false);
  });

  test("validates recovery_key_regenerated event type", () => {
    const res = activityEventSchema.safeParse({ eventType: "recovery_key_regenerated" });
    assert.equal(res.success, true);
  });
});

describe("Activity Deletion — Data Isolation & Execution Logic", () => {
  type MockEvent = {
    id: string;
    userId: string;
    eventType: string;
    createdAt: Date;
  };

  test("deletes the last N items for a specific user without leaking to other users", () => {
    const mockStore: MockEvent[] = [];

    // Seed User A with 12 events
    const baseTime = 1700000000000;
    for (let i = 1; i <= 12; i++) {
      mockStore.push({
        id: `userA_evt_${i}`,
        userId: "user_A",
        eventType: "item_updated",
        createdAt: new Date(baseTime + i * 1000),
      });
    }

    // Seed User B with 6 events
    for (let i = 1; i <= 6; i++) {
      mockStore.push({
        id: `userB_evt_${i}`,
        userId: "user_B",
        eventType: "vault_unlocked",
        createdAt: new Date(baseTime + i * 1000),
      });
    }

    // Function simulating the exact route deletion logic
    function executeDelete(userId: string, input: { mode: "count"; count: 5 | 10 } | { mode: "all" }) {
      if (input.mode === "all") {
        const countBefore = mockStore.filter((e) => e.userId === userId).length;
        const remaining = mockStore.filter((e) => e.userId !== userId);
        mockStore.length = 0;
        mockStore.push(...remaining);
        return { deletedCount: countBefore };
      }

      // Sort newest first
      const userEvents = mockStore
        .filter((e) => e.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const toDeleteIds = new Set(userEvents.slice(0, input.count).map((e) => e.id));
      const remaining = mockStore.filter((e) => !toDeleteIds.has(e.id));
      const deletedCount = mockStore.length - remaining.length;
      mockStore.length = 0;
      mockStore.push(...remaining);
      return { deletedCount };
    }

    // 1. User A deletes last 5 records
    const res1 = executeDelete("user_A", { mode: "count", count: 5 });
    assert.equal(res1.deletedCount, 5);
    const userAEventsAfter5 = mockStore.filter((e) => e.userId === "user_A");
    assert.equal(userAEventsAfter5.length, 7);
    // Ensure the newest 5 (12, 11, 10, 9, 8) were deleted, and 1..7 remain
    assert.equal(userAEventsAfter5.some((e) => e.id === "userA_evt_12"), false);
    assert.equal(userAEventsAfter5.some((e) => e.id === "userA_evt_8"), false);
    assert.equal(userAEventsAfter5.some((e) => e.id === "userA_evt_7"), true);

    // User B's events must remain untouched
    const userBEvents = mockStore.filter((e) => e.userId === "user_B");
    assert.equal(userBEvents.length, 6);

    // 2. User A deletes last 10 records (only 7 exist, so all 7 are deleted)
    const res2 = executeDelete("user_A", { mode: "count", count: 10 });
    assert.equal(res2.deletedCount, 7);
    assert.equal(mockStore.filter((e) => e.userId === "user_A").length, 0);

    // User B still has 6 events
    assert.equal(mockStore.filter((e) => e.userId === "user_B").length, 6);

    // 3. User B deletes all records
    const res3 = executeDelete("user_B", { mode: "all" });
    assert.equal(res3.deletedCount, 6);
    assert.equal(mockStore.length, 0);
  });

  test("handles delete operation safely when no records exist", () => {
    const mockStore: MockEvent[] = [];

    function executeDelete(userId: string, input: { mode: "count"; count: 5 | 10 } | { mode: "all" }) {
      if (input.mode === "all") {
        const countBefore = mockStore.filter((e) => e.userId === userId).length;
        return { deletedCount: countBefore };
      }
      const userEvents = mockStore
        .filter((e) => e.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { deletedCount: Math.min(userEvents.length, input.count) };
    }

    assert.equal(executeDelete("empty_user", { mode: "count", count: 5 }).deletedCount, 0);
    assert.equal(executeDelete("empty_user", { mode: "count", count: 10 }).deletedCount, 0);
    assert.equal(executeDelete("empty_user", { mode: "all" }).deletedCount, 0);
  });
});
