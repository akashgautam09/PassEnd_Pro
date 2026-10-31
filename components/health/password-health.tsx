"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

import { useVault } from "@/context/vault-provider";

type HealthPayload = { title: string; username: string; password: string };
type HealthItem = HealthPayload & { id: string; score: number; label: string; reused: boolean };
type PwnedState = "checking" | "compromised" | "not-found" | "error";

type EncryptedRecord = { _id: string; encryptedData: string; iv: string; cryptoVersion: 1; isTrash: boolean };

function estimateStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  if (/(.)\1{2,}/.test(password) || /password|qwerty|123456/i.test(password)) score = Math.max(0, score - 2);
  return { score, label: ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score] };
}

async function checkPwnedPassword(password: string): Promise<PwnedState> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true" } });
  if (!response.ok) throw new Error("Pwned Passwords lookup failed");
  const matches = (await response.text()).split("\n").some((line) => line.trim().split(":")[0] === suffix);
  return matches ? "compromised" : "not-found";
}

export function PasswordHealth() {
  const { decryptItem } = useVault();
  const [items, setItems] = useState<HealthItem[]>([]);
  const [pwned, setPwned] = useState<Record<string, PwnedState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vault?trash=active", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load vault items");
      const body = (await response.json()) as { items: EncryptedRecord[] };
      const decrypted: HealthPayload[] = [];
      for (const record of body.items) {
        try {
          decrypted.push(await decryptItem<HealthPayload>(record._id, { encryptedData: record.encryptedData, iv: record.iv, cryptoVersion: record.cryptoVersion }));
        } catch {
          setError("One or more vault items could not be decrypted.");
        }
      }
      const passwordCounts = new Map<string, number>();
      for (const item of decrypted) passwordCounts.set(item.password, (passwordCounts.get(item.password) ?? 0) + 1);
      setItems(decrypted.map((item, index) => ({ ...item, id: `${index}-${item.title}`, ...estimateStrength(item.password), reused: (passwordCounts.get(item.password) ?? 0) > 1 })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load password health");
    } finally {
      setIsLoading(false);
    }
  }, [decryptItem]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHealth(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHealth]);

  async function runPwnedCheck(item: HealthItem) {
    setPwned((current) => ({ ...current, [item.id]: "checking" }));
    try {
      const result = await checkPwnedPassword(item.password);
      setPwned((current) => ({ ...current, [item.id]: result }));
    } catch {
      setPwned((current) => ({ ...current, [item.id]: "error" }));
    }
  }

  const weakCount = items.filter((item) => item.score <= 1).length;
  const reusedCount = items.filter((item) => item.reused).length;

  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#e8e4ef] bg-white px-4 py-3"><p className="text-[11px] uppercase tracking-[0.12em] text-[#aaa3b5]">Weak estimates</p><p className="mt-1 text-xl font-semibold text-[#a9435b]">{weakCount}</p></div><div className="rounded-xl border border-[#e8e4ef] bg-white px-4 py-3"><p className="text-[11px] uppercase tracking-[0.12em] text-[#aaa3b5]">Reused locally</p><p className="mt-1 text-xl font-semibold text-[#6245b8]">{reusedCount}</p></div></div><button type="button" onClick={() => void loadHealth()} aria-label="Refresh password health" title="Refresh password health" className="rounded-xl border border-[#e8e4ef] bg-white p-3 text-[#6245b8] hover:bg-[#f7f3ff]"><RefreshCw size={17} /></button></div>{error && <p className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm text-[#a9435b]" role="alert">{error}</p>}{isLoading ? <div className="rounded-2xl border border-[#e8e4ef] bg-white p-10 text-center text-sm text-[#837b8e]">Checking decrypted items locally...</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d9d1e8] bg-white/55 p-10 text-center text-sm text-[#837b8e]">Add a login to see local health estimates.</div> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[#e8e4ef] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-[#3c3348]">{item.title}</h2><p className="mt-1 text-xs text-[#9b94a5]">{item.username}</p></div><div className="flex items-center gap-2 text-xs font-semibold"><span className={item.score <= 1 ? "text-[#b34d63]" : "text-[#6245b8]"}>{item.score <= 1 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}{item.label}</span>{item.reused && <span className="rounded-full bg-[#f0eaff] px-2 py-1 text-[#6245b8]">Reused</span>}</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0edf4] pt-3"><p className="text-xs leading-5 text-[#8a8295]">Strength and reuse are local estimates. HIBP checks only a hash prefix.</p><button type="button" disabled={pwned[item.id] === "checking"} onClick={() => void runPwnedCheck(item)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6245b8] disabled:opacity-50">{pwned[item.id] === "checking" ? "Checking..." : "Check Pwned Passwords"}<ExternalLink size={13} /></button></div>{pwned[item.id] && <p className={`mt-3 text-xs ${pwned[item.id] === "compromised" ? "text-[#b34d63]" : "text-[#4d7a62]"}`}>{pwned[item.id] === "compromised" ? "This password appears in the Pwned Passwords corpus. Change it anywhere it is used." : pwned[item.id] === "not-found" ? "No match found in the Pwned Passwords corpus." : pwned[item.id] === "error" ? "The online check could not be completed." : "Checking..."}</p>}</article>)}</div>}</section>;
}
