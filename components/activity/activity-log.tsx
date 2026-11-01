"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

type ActivityEvent = { eventType: string; createdAt: string };
const labels: Record<string, string> = { vault_created: "Vault created", vault_unlocked: "Vault unlocked", vault_locked: "Vault locked", item_created: "Login created", item_updated: "Login updated", item_trashed: "Login moved to trash", item_restored: "Login restored", item_deleted: "Login permanently deleted", master_password_changed: "Master Password changed" };

export function ActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/activity", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load activity");
      setEvents(((await response.json()) as { events: ActivityEvent[] }).events);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load activity");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void loadEvents(), 0); return () => window.clearTimeout(timer); }, [loadEvents]);
  return <section className="space-y-4">{error && <p className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm text-[#a9435b]" role="alert">{error}</p>}<div className="flex justify-end"><button type="button" onClick={() => void loadEvents()} aria-label="Refresh activity" title="Refresh activity" className="rounded-xl border border-[#e8e4ef] bg-white p-3 text-[#6245b8] hover:bg-[#f7f3ff]"><RefreshCw size={17} /></button></div>{isLoading ? <div className="rounded-2xl border border-[#e8e4ef] bg-white p-10 text-center text-sm text-[#837b8e]">Loading activity...</div> : events.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d9d1e8] bg-white/55 p-10 text-center text-sm text-[#837b8e]">No activity yet.</div> : <div className="divide-y divide-[#f0edf4] rounded-2xl border border-[#e8e4ef] bg-white">{events.map((event, index) => <div key={`${event.createdAt}-${index}`} className="flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eee9ff] text-[#7354d6]"><Activity size={16} /></span><div><p className="text-sm font-medium text-[#51485c]">{labels[event.eventType] ?? "Vault activity"}</p><p className="mt-1 text-xs text-[#9b94a5]">{new Date(event.createdAt).toLocaleString()}</p></div></div>)}</div>}</section>;
}
