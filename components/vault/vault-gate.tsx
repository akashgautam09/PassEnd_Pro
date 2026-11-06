"use client";

import { FormEvent, useState } from "react";

import { useVault } from "@/context/vault-provider";

export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status, isDeriving, error, setupVault, unlockVault, recoveryKey, confirmRecoveryKeySaved, recoverVault } = useVault();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const isSetup = status === "needs-setup";

  function downloadRecoveryKit() {
    if (!recoveryKey) return;
    const blob = new Blob([`PassEnd Pro Emergency Recovery Kit\n\nRecovery Key:\n${recoveryKey}\n\nKeep this key offline. PassEnd cannot recover it.`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "passend-emergency-recovery-kit.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

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

    const succeeded = isSetup ? await setupVault(password) : recoveryMode ? await recoverVault(confirmation, password) : await unlockVault(password);
    if (succeeded) {
      setPassword("");
      setConfirmation("");
    }
  }

  if (status === "recovery-confirmation" && recoveryKey) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5fb] px-5 py-12 sm:px-8">
      <section className="w-full max-w-lg rounded-2xl border border-[#e8e4ef] bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#8066ce]">Emergency Recovery Kit</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#2e2639]">Save this Recovery Key</h1>
        <p className="mt-4 text-sm leading-6 text-[#837b8e]">This is the only recovery path if you forget your Master Password. It is shown only in this browser and is not stored by PassEnd.</p>
        <code className="mt-6 block break-all rounded-xl bg-[#f7f4ff] p-4 text-center text-sm font-semibold tracking-[0.08em] text-[#4c388f]">{recoveryKey}</code>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={downloadRecoveryKit} className="h-10 rounded-xl border border-[#ded7e8] px-4 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff]">Download kit</button><button type="button" onClick={() => window.print()} className="h-10 rounded-xl border border-[#ded7e8] px-4 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff]">Print</button></div>
        <label className="mt-6 flex items-start gap-3 text-sm leading-5 text-[#51485c]"><input type="checkbox" onChange={(event) => { if (event.target.checked) confirmRecoveryKeySaved(); }} className="mt-1 h-4 w-4 accent-[#7354d6]" />I have saved this Recovery Key somewhere safe.</label>
      </section>
    </main>
  );

  if (status === "unlocked") return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5fb] px-5 py-12 sm:px-8">
      <section className="w-full max-w-lg rounded-2xl border border-[#e8e4ef] bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#8066ce]">{isSetup ? "First-time setup" : "Vault locked"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#2e2639]">{isSetup ? "Create your Master Password" : "Unlock your vault"}</h1>
        <p className="mt-4 text-sm leading-6 text-[#837b8e]">{isSetup ? "This password stays in your browser. PassEnd cannot recover it, and losing it may mean losing access to your vault." : recoveryMode ? "Enter your Recovery Key and choose a new Master Password. Recovery happens locally." : "Your Master Password is processed locally to unwrap the vault key. It is never sent to PassEnd."}</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-[#51485c]" htmlFor="master-password">{recoveryMode ? "New Master Password" : "Master Password"}</label>
          <input id="master-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isDeriving} autoComplete={isSetup || recoveryMode ? "new-password" : "current-password"} className="-mt-3 h-12 w-full rounded-xl border border-[#ded7e8] bg-[#fcfbfe] px-4 text-sm outline-none ring-[#c6b7ef] focus:ring-2" />
          {isSetup && <>
            <label className="block text-sm font-medium text-[#51485c]" htmlFor="master-password-confirmation">Confirm Master Password</label>
            <input id="master-password-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isDeriving} autoComplete="new-password" className="-mt-3 h-12 w-full rounded-xl border border-[#ded7e8] bg-[#fcfbfe] px-4 text-sm outline-none ring-[#c6b7ef] focus:ring-2" />
          </>}
          {recoveryMode && <>
            <label className="block text-sm font-medium text-[#51485c]" htmlFor="recovery-key">Recovery Key</label>
            <input id="recovery-key" type="text" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isDeriving} autoComplete="off" placeholder="xxxx-xxxx-..." className="-mt-3 h-12 w-full rounded-xl border border-[#ded7e8] bg-[#fcfbfe] px-4 font-mono text-sm outline-none ring-[#c6b7ef] focus:ring-2" />
          </>}
          {(formError || error) && <p className="text-sm leading-5 text-[#b34d63]" role="alert">{formError ?? error}</p>}
          <button type="submit" disabled={isDeriving || !password || (isSetup && !confirmation)} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#7354d6] text-sm font-semibold text-white transition-colors hover:bg-[#6042bd] disabled:cursor-not-allowed disabled:opacity-50">
            {isDeriving ? "Deriving key..." : isSetup ? "Create vault" : recoveryMode ? "Recover vault" : "Unlock vault"}
          </button>
        </form>
        {!isSetup && <button type="button" onClick={() => { setRecoveryMode((mode) => !mode); setFormError(null); setConfirmation(""); }} className="mt-5 text-sm font-medium text-[#6245b8]">{recoveryMode ? "Back to Master Password unlock" : "Forgot Master Password? Use Recovery Key"}</button>}
        <p className="mt-7 text-xs leading-5 text-[#a19aaa]">The first unlock can take a moment while Argon2id derives your key. The interface remains responsive because derivation runs in a Web Worker.</p>
      </section>
    </main>
  );
}