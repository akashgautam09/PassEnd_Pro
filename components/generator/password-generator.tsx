"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";

import { generateSecurePassword, type GeneratorOptions } from "@/lib/utils/password-generator";

const initialOptions: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

export function PasswordGenerator() {
  const [options, setOptions] = useState(initialOptions);
  const [password, setPassword] = useState(() => generateSecurePassword(initialOptions));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    try {
      setPassword(generateSecurePassword(options));
      setCopied(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate password");
    }
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6">
      <div className="rounded-xl bg-[#f7f4ff] p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8066ce]">Generated locally</p>
        <div className="flex items-center gap-3"><output aria-label="Generated password" className="min-w-0 flex-1 break-all font-mono text-lg font-semibold tracking-[0.04em] text-[#3c3348]">{password}</output><button type="button" aria-label="Copy generated password" title="Copy generated password" onClick={() => void copyPassword()} className="shrink-0 rounded-lg p-2 text-[#6245b8] hover:bg-white">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#51485c]">Length <span className="ml-1 font-normal text-[#9b94a5]">{options.length}</span><input type="range" min="8" max="64" value={options.length} onChange={(event) => setOptions({ ...options, length: Number(event.target.value) })} className="mt-3 w-full accent-[#7354d6]" /></label>
        <div className="grid grid-cols-2 gap-3 text-sm text-[#51485c] sm:pt-1">{(["uppercase", "lowercase", "numbers", "symbols"] as const).map((key) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={options[key]} onChange={(event) => setOptions({ ...options, [key]: event.target.checked })} className="h-4 w-4 accent-[#7354d6]" />{key[0].toUpperCase() + key.slice(1)}</label>)}</div>
      </div>
      {error && <p className="text-sm text-[#b34d63]" role="alert">{error}</p>}
      <button type="button" onClick={generate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7354d6] px-5 text-sm font-semibold text-white hover:bg-[#6042bd]"><RefreshCw size={17} />Generate new password</button>
      <p className="text-xs leading-5 text-[#9b94a5]">Generated passwords stay in browser memory until you leave or replace them. They are not saved unless you explicitly add one to a vault item.</p>
    </section>
  );
}
