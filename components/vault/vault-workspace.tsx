"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArchiveRestore,
  ChevronDown,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Heart,
  KeyRound,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { useVault } from "@/context/vault-provider";
import { subscribeToVaultEvents } from "@/lib/sync/tab-channel";
import {
  base32ToBytes,
  formatTotpDisplay,
  generateTotpCode,
  getTotpTimeRemaining,
  parseTotpUri,
  type TotpConfig,
} from "@/lib/crypto/totp";
import {
  getItemType,
  type LoginPayload,
  type SecureNotePayload,
  type VaultItemType,
} from "@/lib/types/vault";
import { MarkdownViewer } from "@/components/vault/markdown-viewer";

type VaultMode = "active" | "favorites" | "trash";

type LocalItem = {
  id: string;
  type: VaultItemType;
  title: string;
  category: string;
  isFavorite: boolean;
  version: number;
  isTrash: boolean;
  trashedAt: string | null;
  purgeAt: string | null;
  // Login fields
  website?: string;
  username?: string;
  password?: string;
  notes?: string;
  totp?: TotpConfig;
  // Secure Note fields
  content?: string;
};

type ItemFormState = {
  type: VaultItemType;
  title: string;
  category: string;
  isFavorite: boolean;
  // Login fields
  website: string;
  username: string;
  password: string;
  notes: string;
  totpInput: string;
  // Secure Note fields
  content: string;
  previewMarkdown: boolean;
};

type EncryptedRecord = {
  _id: string;
  encryptedData: string;
  iv: string;
  cryptoVersion: 1;
  version: number;
  isFavorite: boolean;
  isTrash: boolean;
  trashedAt: string | null;
  purgeAt: string | null;
};

const emptyForm: ItemFormState = {
  type: "login",
  title: "",
  category: "",
  isFavorite: false,
  website: "",
  username: "",
  password: "",
  notes: "",
  totpInput: "",
  content: "",
  previewMarkdown: false,
};

const loginCategories = ["Personal", "Work", "Finance", "Shopping", "Social", "Education", "Other"];
const noteCategories = ["Personal", "Work", "Finance", "Legal", "Health", "Confidential", "Other"];

function createItemId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

async function recordActivity(
  eventType: "item_created" | "item_updated" | "item_trashed" | "item_restored" | "item_deleted"
) {
  await fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType }),
  }).catch(() => undefined);
}

function TotpBadge({ totp }: { totp: TotpConfig }) {
  const [code, setCode] = useState<string>("------");
  const [remaining, setRemaining] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function updateCode() {
      try {
        const nextCode = await generateTotpCode(totp);
        if (!cancelled) setCode(nextCode);
      } catch {
        if (!cancelled) setCode("ERROR");
      }
    }

    function tick() {
      const info = getTotpTimeRemaining(totp.period ?? 30);
      setRemaining(info.remainingSeconds);
      if (info.remainingSeconds === (totp.period ?? 30)) {
        void updateCode();
      }
    }

    void updateCode();
    tick();

    const interval = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [totp]);

  async function handleCopy() {
    if (code && code !== "------" && code !== "ERROR") {
      await copyToClipboard(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#ded7e8] bg-[#fbf9fe] p-3">
      <div className="flex items-center justify-between text-xs text-[#7b7388]">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-[#7354d6]">
          One-Time Code (TOTP)
        </span>
        <span className={`font-mono text-xs font-semibold ${remaining <= 5 ? "text-[#c2410c]" : "text-[#7b7388]"}`}>
          {remaining}s
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-lg font-bold tracking-widest text-[#2f273d]">
          {formatTotpDisplay(code)}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label="Copy one-time code"
          title="Copy one-time code"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded7e8] bg-white px-2.5 py-1 text-xs font-semibold text-[#6245b8] hover:bg-[#f6f3fc]"
        >
          <Copy size={13} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function VaultWorkspace({ mode = "active" }: { mode?: VaultMode }) {
  const { encryptItem, decryptItem, notifyMutation } = useVault();
  const [items, setItems] = useState<LocalItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | "login" | "note">("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vault?trash=${mode === "trash" ? "trash" : "active"}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load vault items");
      const body = (await response.json()) as { items: EncryptedRecord[] };
      const decrypted: LocalItem[] = [];

      for (const record of body.items) {
        try {
          const payload = await decryptItem<Record<string, unknown>>(record._id, {
            encryptedData: record.encryptedData,
            iv: record.iv,
            cryptoVersion: record.cryptoVersion,
          });

          const itemType = getItemType(payload);
          if (itemType === "note") {
            decrypted.push({
              id: record._id,
              type: "note",
              title: String(payload.title ?? "Untitled Note"),
              category: String(payload.category ?? ""),
              content: String(payload.content ?? ""),
              isFavorite: record.isFavorite,
              version: record.version ?? 1,
              isTrash: record.isTrash,
              trashedAt: record.trashedAt,
              purgeAt: record.purgeAt,
            });
          } else {
            decrypted.push({
              id: record._id,
              type: "login",
              title: String(payload.title ?? "Untitled Login"),
              category: String(payload.category ?? ""),
              website: String(payload.website ?? ""),
              username: String(payload.username ?? ""),
              password: String(payload.password ?? ""),
              notes: String(payload.notes ?? ""),
              totp: payload.totp as TotpConfig | undefined,
              isFavorite: record.isFavorite,
              version: record.version ?? 1,
              isTrash: record.isTrash,
              trashedAt: record.trashedAt,
              purgeAt: record.purgeAt,
            });
          }
        } catch {
          setError("One or more vault items could not be decrypted.");
        }
      }

      setItems(mode === "favorites" ? decrypted.filter((item) => item.isFavorite) : decrypted);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load vault items");
    } finally {
      setIsLoading(false);
    }
  }, [decryptItem, mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    const unsubscribe = subscribeToVaultEvents((event) => {
      if (event.type === "VAULT_MUTATED") {
        void loadItems();
      }
    });
    return unsubscribe;
  }, [loadItems]);

  function openCreateForm(initialType: VaultItemType = "login") {
    setEditingId(null);
    setForm({ ...emptyForm, type: initialType });
    setFormErrors({});
    setConflictError(null);
    setShowFormPassword(false);
    setIsFormOpen(true);
  }

  function openEditForm(item: LocalItem) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      title: item.title,
      category: item.category ?? "",
      isFavorite: item.isFavorite,
      website: item.website ?? "",
      username: item.username ?? "",
      password: item.password ?? "",
      notes: item.notes ?? "",
      totpInput: item.totp?.secret ?? "",
      content: item.content ?? "",
      previewMarkdown: false,
    });
    setFormErrors({});
    setConflictError(null);
    setShowFormPassword(false);
    setIsFormOpen(true);
  }

  async function reloadConflictedItem() {
    if (!editingId) return;
    setConflictError(null);
    try {
      const response = await fetch(`/api/vault/${editingId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to fetch latest item");
      const body = (await response.json()) as { item: EncryptedRecord };
      const decrypted = await decryptItem<Record<string, unknown>>(body.item._id, {
        encryptedData: body.item.encryptedData,
        iv: body.item.iv,
        cryptoVersion: body.item.cryptoVersion,
      });

      const itemType = getItemType(decrypted);
      setForm({
        type: itemType,
        title: String(decrypted.title ?? ""),
        category: String(decrypted.category ?? ""),
        isFavorite: body.item.isFavorite,
        website: String(decrypted.website ?? ""),
        username: String(decrypted.username ?? ""),
        password: String(decrypted.password ?? ""),
        notes: String(decrypted.notes ?? ""),
        totpInput: (decrypted.totp as TotpConfig | undefined)?.secret ?? "",
        content: String(decrypted.content ?? ""),
        previewMarkdown: false,
      });
      await loadItems();
    } catch {
      setConflictError("Failed to reload latest version. Please try again.");
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.title.trim()) nextErrors.title = "Enter a title for this item.";

    let totpConfig: TotpConfig | undefined = undefined;

    if (form.type === "login") {
      if (!form.username.trim()) nextErrors.username = "Enter a username or email.";
      if (!form.password) nextErrors.password = "Enter the password for this login.";
      if (form.website && !/^https?:\/\//i.test(form.website.trim())) {
        nextErrors.website = "Use a URL beginning with http:// or https://.";
      }

      const cleanTotp = form.totpInput.trim();
      if (cleanTotp) {
        if (cleanTotp.toLowerCase().startsWith("otpauth://")) {
          try {
            totpConfig = parseTotpUri(cleanTotp);
          } catch (e) {
            nextErrors.totp = e instanceof Error ? e.message : "Invalid TOTP URI";
          }
        } else {
          try {
            const rawBytes = base32ToBytes(cleanTotp);
            if (rawBytes.length < 4) {
              nextErrors.totp = "Secret is too short (minimum 8 Base32 characters)";
            } else {
              totpConfig = {
                secret: cleanTotp.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, ""),
                algorithm: "SHA-1",
                digits: 6,
                period: 30,
              };
            }
          } catch {
            nextErrors.totp = "Invalid Base32 secret (allowed characters: A-Z, 2-7)";
          }
        }
      }
    } else {
      if (!form.content.trim()) {
        nextErrors.content = "Enter content for your secure note.";
      }
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    setError(null);
    setConflictError(null);
    const id = editingId ?? createItemId();

    try {
      let sensitivePayload: LoginPayload | SecureNotePayload;

      if (form.type === "note") {
        sensitivePayload = {
          type: "note",
          title: form.title.trim(),
          category: form.category || undefined,
          content: form.content,
        };
      } else {
        sensitivePayload = {
          type: "login",
          title: form.title.trim(),
          category: form.category || undefined,
          website: form.website.trim(),
          username: form.username.trim(),
          password: form.password,
          notes: form.notes,
          totp: totpConfig,
        };
      }

      const encrypted = await encryptItem(id, sensitivePayload);
      const existing = items.find((item) => item.id === id);
      const response = await fetch(editingId ? `/api/vault/${id}` : "/api/vault", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...encrypted,
          isFavorite: form.isFavorite,
          ...(editingId ? { version: existing?.version ?? 1 } : {}),
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setConflictError(body?.error ?? "This item was modified in another session. Please reload to review the latest changes.");
          return;
        }
        if (response.status === 429) {
          const retry = response.headers.get("Retry-After");
          throw new Error(`Rate limit exceeded. Please wait ${retry ? `${retry}s` : "a moment"} before saving.`);
        }
        if (response.status === 413) {
          throw new Error("Payload is too large. Please shorten the notes or fields.");
        }
        throw new Error("Unable to save vault item");
      }

      await recordActivity(editingId ? "item_updated" : "item_created");
      notifyMutation(editingId ? "updated" : "created", id);
      setIsFormOpen(false);
      setForm(emptyForm);
      await loadItems();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save vault item");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateItem(id: string, patch: { isFavorite?: boolean; isTrash?: boolean }) {
    setError(null);
    try {
      const item = items.find((current) => current.id === id);
      if (!item) throw new Error("Vault item is no longer available");
      const response = await fetch(`/api/vault/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, version: item.version }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          setError("This item was modified in another session. Refreshing vault...");
          await loadItems();
          return;
        }
        if (response.status === 429) {
          const retry = response.headers.get("Retry-After");
          setError(`Rate limit exceeded. Please wait ${retry ? `${retry}s` : "a moment"} and try again.`);
          return;
        }
        throw new Error("Unable to update vault item");
      }
      if (patch.isTrash === true) {
        await recordActivity("item_trashed");
        notifyMutation("trashed", id);
      } else if (patch.isTrash === false) {
        await recordActivity("item_restored");
        notifyMutation("restored", id);
      } else {
        await recordActivity("item_updated");
        notifyMutation("updated", id);
      }
      await loadItems();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update vault item");
    }
  }

  async function permanentlyDelete(id: string) {
    if (!window.confirm("Permanently delete this vault item? This cannot be undone.")) return;
    try {
      const item = items.find((current) => current.id === id);
      if (!item) throw new Error("Vault item is no longer available");
      const response = await fetch(`/api/vault/${id}?version=${item.version}`, { method: "DELETE" });
      if (!response.ok) {
        if (response.status === 409) {
          setError("This item was modified in another session. Refreshing vault...");
          await loadItems();
          return;
        }
        if (response.status === 429) {
          const retry = response.headers.get("Retry-After");
          setError(`Rate limit exceeded. Please wait ${retry ? `${retry}s` : "a moment"} and try again.`);
          return;
        }
        throw new Error("Unable to delete vault item");
      }
      await recordActivity("item_deleted");
      notifyMutation("deleted", id);
      await loadItems();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete vault item");
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (!normalizedQuery) return true;

    if (item.type === "note") {
      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        (item.content?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    }

    return [item.title, item.website ?? "", item.username ?? "", item.notes ?? "", item.category]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  return (
    <div className="space-y-5">
      {/* Search, Filter Pills & Add Actions */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e8e4ef] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[#e8e4ef] bg-[#fcfbfe] px-3 text-[#9b94a5] sm:max-w-md" htmlFor="vault-search">
          <Search size={17} />
          <input
            id="vault-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search decrypted logins and notes"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#453c50] outline-none placeholder:text-[#aaa3b5]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* Item Type Filters */}
          <div className="flex rounded-xl border border-[#ded7e8] bg-[#f9f7fc] p-1 text-xs font-semibold text-[#665e72]">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-lg px-2.5 py-1 transition ${typeFilter === "all" ? "bg-white text-[#7354d6] shadow-sm" : "hover:text-[#3c3348]"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("login")}
              className={`rounded-lg px-2.5 py-1 transition ${typeFilter === "login" ? "bg-white text-[#7354d6] shadow-sm" : "hover:text-[#3c3348]"}`}
            >
              Logins
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("note")}
              className={`rounded-lg px-2.5 py-1 transition ${typeFilter === "note" ? "bg-white text-[#7354d6] shadow-sm" : "hover:text-[#3c3348]"}`}
            >
              Notes
            </button>
          </div>

          {mode === "active" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateForm("login")}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#7354d6] px-3.5 text-xs font-semibold text-white hover:bg-[#6042bd]"
              >
                <Plus size={15} /> Add login
              </button>
              <button
                type="button"
                onClick={() => openCreateForm("note")}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#7354d6] bg-[#f7f4fd] px-3.5 text-xs font-semibold text-[#7354d6] hover:bg-[#efeafb]"
              >
                <FileText size={15} /> Add note
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm text-[#a9435b]" role="alert">{error}</p>}

      {/* Creation / Edit Form Modal */}
      {isFormOpen && (
        <form onSubmit={saveItem} noValidate className="space-y-6 rounded-2xl border border-[#dcd2f4] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8066ce]">
                {editingId ? "Update encrypted item" : "New encrypted item"}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#3c3348]">
                {editingId ? (form.type === "note" ? "Edit Secure Note" : "Edit Login") : (form.type === "note" ? "New Secure Note" : "New Login")}
              </h2>
            </div>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-sm font-medium text-[#837b8e] hover:text-[#6245b8]">
              Cancel
            </button>
          </div>

          {/* Type Selector (only on create) */}
          {!editingId && (
            <div className="flex rounded-xl border border-[#ded7e8] bg-[#f9f7fc] p-1 text-xs font-semibold text-[#665e72] max-w-xs">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "login" })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${form.type === "login" ? "bg-white text-[#7354d6] shadow-sm" : "hover:text-[#3c3348]"}`}
              >
                <KeyRound size={14} /> Login
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "note" })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${form.type === "note" ? "bg-white text-[#7354d6] shadow-sm" : "hover:text-[#3c3348]"}`}
              >
                <FileText size={14} /> Secure Note
              </button>
            </div>
          )}

          {conflictError && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#f2b8b5] bg-[#fff0ee] p-4 text-sm text-[#b3261e]" role="alert">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{conflictError}</span>
                <button
                  type="button"
                  onClick={() => void reloadConflictedItem()}
                  className="rounded-lg bg-[#b3261e] px-3 py-1 text-xs font-medium text-white hover:bg-[#8c1d18]"
                >
                  Reload Latest Version
                </button>
              </div>
              <p className="text-xs text-[#8c1d18]">
                Another tab or session updated this record. Reloading will refresh the form with the latest saved version.
              </p>
            </div>
          )}

          {/* Form Fields for Login vs Note */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="item-title" className="block text-sm font-medium text-[#51485c]">
                Title <span className="text-[#a9435b]">*</span>
              </label>
              <input
                id="item-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={form.type === "note" ? "e.g. WiFi Backup Keys" : "e.g. Google"}
                aria-invalid={Boolean(formErrors.title)}
                className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef] ${formErrors.title ? "border-[#d47c8c]" : "border-[#ded7e8]"}`}
              />
              {formErrors.title && <p className="text-xs text-[#b34d63]">{formErrors.title}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="item-category" className="block text-sm font-medium text-[#51485c]">
                Category <span className="text-xs font-normal text-[#9b94a5]">Optional</span>
              </label>
              <div className="relative">
                <select
                  id="item-category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className="h-11 w-full appearance-none rounded-xl border border-[#ded7e8] bg-white px-3 pr-10 text-sm text-[#51485c] outline-none focus:ring-2 focus:ring-[#c6b7ef]"
                >
                  <option value="">Select category</option>
                  {(form.type === "note" ? noteCategories : loginCategories).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-[#9b94a5]" />
              </div>
            </div>

            {form.type === "login" ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="login-website" className="block text-sm font-medium text-[#51485c]">
                    Website URL <span className="text-xs font-normal text-[#9b94a5]">Optional</span>
                  </label>
                  <input
                    id="login-website"
                    type="url"
                    value={form.website}
                    onChange={(event) => setForm({ ...form, website: event.target.value })}
                    placeholder="https://example.com"
                    aria-invalid={Boolean(formErrors.website)}
                    className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef] ${formErrors.website ? "border-[#d47c8c]" : "border-[#ded7e8]"}`}
                  />
                  {formErrors.website && <p className="text-xs text-[#b34d63]">{formErrors.website}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-username" className="block text-sm font-medium text-[#51485c]">
                    Username / Email <span className="text-[#a9435b]">*</span>
                  </label>
                  <input
                    id="login-username"
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    placeholder="Enter username or email"
                    aria-invalid={Boolean(formErrors.username)}
                    className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef] ${formErrors.username ? "border-[#d47c8c]" : "border-[#ded7e8]"}`}
                  />
                  {formErrors.username && <p className="text-xs text-[#b34d63]">{formErrors.username}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-password" className="block text-sm font-medium text-[#51485c]">
                    Password <span className="text-[#a9435b]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showFormPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      placeholder="Enter password"
                      aria-invalid={Boolean(formErrors.password)}
                      className={`h-11 w-full rounded-xl border px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef] ${formErrors.password ? "border-[#d47c8c]" : "border-[#ded7e8]"}`}
                    />
                    <button
                      type="button"
                      aria-label={showFormPassword ? "Hide password" : "Show password"}
                      title={showFormPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowFormPassword((visible) => !visible)}
                      className="absolute right-3 top-3 text-[#837b8e] hover:text-[#6245b8]"
                    >
                      {showFormPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-xs text-[#b34d63]">{formErrors.password}</p>}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="login-totp" className="block text-sm font-medium text-[#51485c]">
                    Authenticator Key / TOTP URI <span className="text-xs font-normal text-[#9b94a5]">Optional</span>
                  </label>
                  <input
                    id="login-totp"
                    value={form.totpInput}
                    onChange={(event) => setForm({ ...form, totpInput: event.target.value })}
                    placeholder="e.g. JBSWY3DPEHPK3PXP or paste otpauth://totp/..."
                    aria-invalid={Boolean(formErrors.totp)}
                    className={`h-11 w-full rounded-xl border px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef] ${formErrors.totp ? "border-[#d47c8c]" : "border-[#ded7e8]"}`}
                  />
                  {formErrors.totp && <p className="text-xs text-[#b34d63]">{formErrors.totp}</p>}
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-[#ded7e8] bg-[#faf8fc] p-3 text-xs leading-5 text-[#625970]">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[#7354d6]" />
                    <span>
                      <strong>Two-Factor Security Notice:</strong> Storing passwords and 2FA authenticator seeds in the same vault means both factors unlock together. For high-security accounts requiring independent factors, maintain TOTP seeds in a separate authenticator app.
                    </span>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="login-notes" className="block text-sm font-medium text-[#51485c]">
                    Private Notes <span className="text-xs font-normal text-[#9b94a5]">Optional</span>
                  </label>
                  <textarea
                    id="login-notes"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Add additional private information..."
                    rows={3}
                    className="w-full resize-y rounded-xl border border-[#ded7e8] p-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]"
                  />
                </div>
              </>
            ) : (
              /* Secure Note Editor */
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="note-content" className="block text-sm font-medium text-[#51485c]">
                    Note Content (Markdown supported) <span className="text-[#a9435b]">*</span>
                  </label>
                  <div className="flex rounded-lg border border-[#ded7e8] bg-[#f9f7fc] p-0.5 text-xs font-medium text-[#665e72]">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, previewMarkdown: false })}
                      className={`rounded px-2.5 py-1 ${!form.previewMarkdown ? "bg-white text-[#7354d6] shadow-xs" : "hover:text-[#3c3348]"}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, previewMarkdown: true })}
                      className={`rounded px-2.5 py-1 ${form.previewMarkdown ? "bg-white text-[#7354d6] shadow-xs" : "hover:text-[#3c3348]"}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {form.previewMarkdown ? (
                  <div className="min-h-[140px] rounded-xl border border-[#ded7e8] bg-[#faf9fc] p-4 text-sm text-[#453c50]">
                    {form.content ? (
                      <MarkdownViewer content={form.content} />
                    ) : (
                      <span className="italic text-[#9b94a5]">Nothing to preview yet.</span>
                    )}
                  </div>
                ) : (
                  <textarea
                    id="note-content"
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="Write your secret notes here... Supports Markdown formatting (# Heading, **bold**, `code`, etc.)"
                    rows={6}
                    aria-invalid={Boolean(formErrors.content)}
                    className={`w-full resize-y rounded-xl border p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-[#c6b7ef] ${formErrors.content ? "border-[#d47c8c]" : "border-[#ded7e8]"}`}
                  />
                )}
                {formErrors.content && <p className="text-xs text-[#b34d63]">{formErrors.content}</p>}
                <p className="text-[11px] text-[#9b94a5]">
                  Note text is client-encrypted using AES-256-GCM before transmission. It is never stored or processed in plaintext on the server.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-pressed={form.isFavorite}
            onClick={() => setForm({ ...form, isFavorite: !form.isFavorite })}
            className={`inline-flex items-center gap-2 text-sm font-medium ${form.isFavorite ? "text-[#6245b8]" : "text-[#6f6878]"}`}
          >
            <Heart size={18} fill={form.isFavorite ? "currentColor" : "none"} />
            {form.isFavorite ? "Added to Favorites" : "Add to Favorites"}
          </button>

          <div className="flex justify-end border-t border-[#f0edf4] pt-5">
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 rounded-xl bg-[#7354d6] px-5 text-sm font-semibold text-white hover:bg-[#6042bd] disabled:opacity-50"
            >
              {isSaving ? "Encrypting..." : editingId ? "Save changes" : "Save encrypted item"}
            </button>
          </div>
        </form>
      )}

      {/* Item List / Cards */}
      {isLoading ? (
        <div className="rounded-2xl border border-[#e8e4ef] bg-white p-10 text-center text-sm text-[#837b8e]">
          Loading encrypted vault items...
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9d1e8] bg-white/55 p-10 text-center text-sm text-[#837b8e]">
          {mode === "trash"
            ? "Trash is empty."
            : mode === "favorites"
              ? "No favorites yet."
              : query
                ? "No matching items found."
                : "Your vault is empty. Add your first login or secure note."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleItems.map((item) => {
            const passwordVisible = visiblePasswords.has(item.id);

            return (
              <article key={item.id} className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${item.type === "note" ? "bg-[#f3edf9] text-[#7354d6]" : "bg-[#eaf5ea] text-[#2d7d2d]"}`}>
                        {item.type === "note" ? <FileText size={11} /> : <KeyRound size={11} />}
                        {item.type === "note" ? "Secure Note" : "Login"}
                      </span>
                      {item.category && (
                        <span className="rounded-md border border-[#eee8f5] bg-[#faf8fc] px-1.5 py-0.5 text-[10px] text-[#786e85]">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 truncate font-semibold text-[#3c3348]">{item.title}</h2>
                    {item.type === "login" && (
                      <p className="mt-0.5 truncate text-xs text-[#9b94a5]">{item.website || "No website"}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label={item.isFavorite ? "Remove favorite" : "Add favorite"}
                    title={item.isFavorite ? "Remove favorite" : "Add favorite"}
                    onClick={() => updateItem(item.id, { isFavorite: !item.isFavorite })}
                    className={item.isFavorite ? "text-[#7354d6]" : "text-[#b9b1c2]"}
                  >
                    <Heart size={18} fill={item.isFavorite ? "currentColor" : "none"} />
                  </button>
                </div>

                {/* Login Fields */}
                {item.type === "login" ? (
                  <dl className="mt-5 space-y-3 text-sm">
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#aaa3b5]">Username/Email</dt>
                      <dd className="mt-1 flex items-center justify-between gap-3 text-[#51485c]">
                        <span className="truncate">{item.username}</span>
                        <button
                          type="button"
                          aria-label="Copy username"
                          title="Copy username"
                          onClick={() => void copyToClipboard(item.username ?? "")}
                          className="text-[#837b8e] hover:text-[#7354d6]"
                        >
                          <Copy size={15} />
                        </button>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#aaa3b5]">Password</dt>
                      <dd className="mt-1 flex items-center justify-between gap-3 font-mono text-[#51485c]">
                        <span>{passwordVisible ? item.password : "••••••••••••"}</span>
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={passwordVisible ? "Hide password" : "Show password"}
                            title={passwordVisible ? "Hide password" : "Show password"}
                            onClick={() =>
                              setVisiblePasswords((current) => {
                                const next = new Set(current);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              })
                            }
                            className="text-[#837b8e] hover:text-[#7354d6]"
                          >
                            {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button
                            type="button"
                            aria-label="Copy password"
                            title="Copy password"
                            onClick={() => void copyToClipboard(item.password ?? "")}
                            className="text-[#837b8e] hover:text-[#7354d6]"
                          >
                            <Copy size={15} />
                          </button>
                        </span>
                      </dd>
                    </div>
                  </dl>
                ) : (
                  /* Secure Note Body */
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-[0.12em] text-[#aaa3b5]">Encrypted Content</span>
                      <button
                        type="button"
                        onClick={() => {
                          void copyToClipboard(item.content ?? "");
                          setCopiedNoteId(item.id);
                          setTimeout(() => setCopiedNoteId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6245b8] hover:text-[#4f349d]"
                      >
                        <Copy size={12} /> {copiedNoteId === item.id ? "Copied" : "Copy note"}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[#eee8f5] bg-[#faf8fc] p-3 text-xs leading-relaxed text-[#453c50]">
                      <MarkdownViewer content={item.content ?? ""} />
                    </div>
                  </div>
                )}

                {item.totp && <TotpBadge totp={item.totp} />}

                {item.notes && <p className="mt-4 line-clamp-2 text-sm leading-5 text-[#837b8e]">{item.notes}</p>}

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#f0edf4] pt-4">
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6245b8]"
                  >
                    <Edit3 size={14} /> Edit
                  </button>

                  {mode === "trash" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { isTrash: false })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6245b8]"
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => void permanentlyDelete(item.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a9435b]"
                      >
                        <Trash2 size={14} /> Delete permanently
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, { isTrash: true })}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a9435b]"
                    >
                      <ArchiveRestore size={14} /> Move to trash
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
