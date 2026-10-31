"use client";

import { FormEvent, useState } from "react";

import { useVault } from "@/context/vault-provider";

export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status, isDeriving, error, setupVault, unlockVault } = useVault();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const isSetup = status === "needs-setup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (password.length < 12) {
      setFormError("Use at least 12 characters for your PassEnd Master Password.");
      return;
    }
    if (isSetup && password !== confirmation) {
      setFormError("The Master Passwords do not match.");
      return;
    }

    const succeeded = isSetup ? await setupVault(password) : await unlockVault(password);
    if (succeeded) {
      setPassword("");
      setConfirmation("");
    }
  }

  if (status === "unlocked") return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5fb] px-5 py-12 sm:px-8">
      <section className="w-full max-w-lg rounded-2xl border border-[#e8e4ef] bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#8066ce]">{isSetup ? "First-time setup" : "Vault locked"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#2e2639]">{isSetup ? "Create your Master Password" : "Unlock your vault"}</h1>
        <p className="mt-4 text-sm leading-6 text-[#837b8e]">{isSetup ? "This password stays in your browser. PassEnd cannot recover it, and losing it may mean losing access to your vault." : "Your Master Password is processed locally to unwrap the vault key. It is never sent to PassEnd."}</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-[#51485c]" htmlFor="master-password">Master Password</label>
          <input id="master-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isDeriving} autoComplete={isSetup ? "new-password" : "current-password"} className="-mt-3 h-12 w-full rounded-xl border border-[#ded7e8] bg-[#fcfbfe] px-4 text-sm outline-none ring-[#c6b7ef] focus:ring-2" />
          {isSetup && <>
            <label className="block text-sm font-medium text-[#51485c]" htmlFor="master-password-confirmation">Confirm Master Password</label>
            <input id="master-password-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isDeriving} autoComplete="new-password" className="-mt-3 h-12 w-full rounded-xl border border-[#ded7e8] bg-[#fcfbfe] px-4 text-sm outline-none ring-[#c6b7ef] focus:ring-2" />
          </>}
          {(formError || error) && <p className="text-sm leading-5 text-[#b34d63]" role="alert">{formError ?? error}</p>}
          <button type="submit" disabled={isDeriving || !password || (isSetup && !confirmation)} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#7354d6] text-sm font-semibold text-white transition-colors hover:bg-[#6042bd] disabled:cursor-not-allowed disabled:opacity-50">
            {isDeriving ? "Deriving key..." : isSetup ? "Create vault" : "Unlock vault"}
          </button>
        </form>
        <p className="mt-7 text-xs leading-5 text-[#a19aaa]">The first unlock can take a moment while Argon2id derives your key. The interface remains responsive because derivation runs in a Web Worker.</p>
      </section>
    </main>
  );
}