"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

type ActivityEvent = {
  eventType: string;
  createdAt: string;
};

const labels: Record<string, string> = {
  vault_created: "Vault created",
  vault_unlocked: "Vault unlocked",
  vault_locked: "Vault locked",
  item_created: "Login created",
  item_updated: "Login updated",
  item_trashed: "Login moved to trash",
  item_restored: "Login restored",
  item_deleted: "Login permanently deleted",
  master_password_changed: "Master Password changed",
  recovery_key_regenerated: "Recovery key regenerated",
};

type DeleteTarget =
  | { mode: "count"; count: 5 }
  | { mode: "count"; count: 10 }
  | { mode: "all" };

export function ActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Deletion controls state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/activity", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load activity");
      const data = (await response.json()) as { events: ActivityEvent[] };
      setEvents(data.events);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load activity");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvents]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/activity", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingDelete),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete activity records.");
      }

      const result = (await response.json()) as { deletedCount?: number };
      const count = result.deletedCount ?? (pendingDelete.mode === "count" ? pendingDelete.count : events.length);

      setSuccessMessage(
        pendingDelete.mode === "all"
          ? "All activity records were deleted."
          : `Deleted the last ${count} activity ${count === 1 ? "record" : "records"}.`
      );

      setPendingDelete(null);
      await loadEvents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete activity records.");
    } finally {
      setIsDeleting(false);
    }
  }

  const deleteTitle =
    pendingDelete?.mode === "all"
      ? "Clear all activity records?"
      : `Delete last ${pendingDelete?.count} activity records?`;

  const deleteDescription =
    pendingDelete?.mode === "all"
      ? "This will permanently remove all activity entries from your log. Your stored passwords and vault data will remain completely safe."
      : `This will permanently remove the most recent ${pendingDelete?.count} entries from your activity log. Your stored passwords and vault data will remain completely safe.`;

  return (
    <section className="space-y-4">
      {/* Feedback Messages */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-[#f5b8c4] bg-[#fff5f7] px-4 py-3 text-sm text-[#a03a51]"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b34d63]" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-[#c4e3cb] bg-[#f4faf5] px-4 py-3 text-sm text-[#2f6340]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3b8c56]" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded-md p-1 text-[#41694f] hover:bg-[#e4f3e8]"
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#837b8e]">
          {events.length} {events.length === 1 ? "event" : "events"} recorded
        </span>

        <div className="flex items-center gap-2">
          {/* Delete Action Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              disabled={isLoading || events.length === 0}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8e4ef] bg-white px-3 py-2 text-xs font-semibold text-[#6245b8] hover:bg-[#f7f3ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} className="text-[#8e5272]" />
              <span>Delete Activity</span>
              <ChevronDown size={13} className="text-[#837b8e]" />
            </button>

            {isDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-[#e8e4ef] bg-white p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setPendingDelete({ mode: "count", count: 5 });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#51485c] hover:bg-[#f7f3ff] hover:text-[#6245b8]"
                >
                  <Trash2 size={13} className="text-[#837b8e]" />
                  Delete last 5 records
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setPendingDelete({ mode: "count", count: 10 });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#51485c] hover:bg-[#f7f3ff] hover:text-[#6245b8]"
                >
                  <Trash2 size={13} className="text-[#837b8e]" />
                  Delete last 10 records
                </button>
                <div className="my-1 border-t border-[#f2eefb]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setPendingDelete({ mode: "all" });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#a03a51] hover:bg-[#fff5f7]"
                >
                  <Trash2 size={13} className="text-[#b34d63]" />
                  Clear all activity
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => void loadEvents()}
            aria-label="Refresh activity"
            title="Refresh activity"
            disabled={isLoading}
            className="rounded-xl border border-[#e8e4ef] bg-white p-2.5 text-[#6245b8] hover:bg-[#f7f3ff] disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-activity-title"
          aria-describedby="delete-activity-desc"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#e8e4ef] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#f2eefb] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff1f3] text-[#a9435b]">
                  <AlertTriangle size={16} />
                </span>
                <h3 id="delete-activity-title" className="font-semibold text-[#3c3348]">
                  {deleteTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
                className="rounded-lg p-1 text-[#837b8e] hover:bg-[#f2eefb] hover:text-[#3c3348] disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p id="delete-activity-desc" className="text-sm leading-relaxed text-[#655d71]">
                {deleteDescription}
              </p>
              <div className="rounded-xl border border-[#ded7e8] bg-[#faf9fc] p-3 text-xs text-[#837b8e]">
                This action cannot be undone.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#f2eefb] pt-4">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
                className="rounded-xl border border-[#ded7e8] bg-white px-4 py-2 text-sm font-semibold text-[#51485c] hover:bg-[#faf9fc] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteConfirm()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#c24158] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a93247] disabled:opacity-50"
              >
                {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      {isLoading ? (
        <div className="rounded-2xl border border-[#e8e4ef] bg-white p-10 text-center text-sm text-[#837b8e]">
          Loading activity...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9d1e8] bg-white/55 p-10 text-center text-sm text-[#837b8e]">
          No activity records found.
        </div>
      ) : (
        <div className="divide-y divide-[#f0edf4] rounded-2xl border border-[#e8e4ef] bg-white">
          {events.map((event, index) => (
            <div key={`${event.createdAt}-${index}`} className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eee9ff] text-[#7354d6]">
                <Activity size={16} />
              </span>
              <div>
                <p className="text-sm font-medium text-[#51485c]">
                  {labels[event.eventType] ?? "Vault activity"}
                </p>
                <p className="mt-1 text-xs text-[#9b94a5]">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
