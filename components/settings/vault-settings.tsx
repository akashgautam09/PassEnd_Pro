"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Save } from "lucide-react";

import { useVault } from "@/context/vault-provider";

export function VaultSettings() {
  const { autoLockMinutes, setAutoLockMinutes, changeMasterPassword, regenerateRecoveryKey, isDeriving, lockVault } = useVault();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [masterPasswordError, setMasterPasswordError] = useState<string | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFormError(null);
    setMasterPasswordError(null);
    if (nextPassword.length < 12) return setFormError("Use at least 12 characters for the new Master Password.");
    if (nextPassword !== confirmation) return setFormError("The new Master Passwords do not match.");
    const changed = await changeMasterPassword(currentPassword, nextPassword);
    if (changed) {
      setCurrentPassword("");
      setNextPassword("");
      setConfirmation("");
      setMessage("Master Password changed. Your vault encryption key was re-wrapped.");
    } else {
      setMasterPasswordError("The current Master Password was incorrect or the change could not be saved.");
    }
  }

  async function rotateRecoveryKey() {
    setRecoveryMessage(null);
    setRecoveryError(null);
    if (!recoveryPassword) return setRecoveryError("Enter your current Master Password to regenerate the Recovery Key.");
    const regenerated = await regenerateRecoveryKey(recoveryPassword);
    if (regenerated) {
      setRecoveryPassword("");
      setRecoveryMessage("Your new Emergency Recovery Kit is ready to save.");
    } else {
      setRecoveryError("The current Master Password was incorrect or the Recovery Key could not be regenerated.");
    }
  }

  return <div className="space-y-5"><section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee9ff] text-[#7354d6]"><LockKeyhole size={19} /></span><div><h2 className="font-semibold text-[#3c3348]">Vault lock</h2><p className="mt-1 text-sm leading-5 text-[#837b8e]">The VEK stays in memory only. Inactivity clears the application key reference.</p></div></div><label className="mt-5 block text-sm font-medium text-[#51485c]" htmlFor="auto-lock">Auto-lock after</label><select id="auto-lock" value={autoLockMinutes} onChange={(event) => setAutoLockMinutes(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] bg-white px-3 text-sm text-[#51485c] outline-none focus:ring-2 focus:ring-[#c6b7ef] sm:max-w-xs"><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select><button type="button" onClick={lockVault} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-[#ded7e8] px-4 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff]"><LockKeyhole size={16} />Lock now</button></section><section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-semibold text-[#3c3348]">Change Master Password</h2><p className="mt-1 text-sm leading-5 text-[#837b8e]">PassEnd re-wraps the same vault key. Vault items are not decrypted or re-encrypted.</p><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-medium text-[#51485c]">Current Master Password<input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]" /></label><label className="block text-sm font-medium text-[#51485c]">New Master Password<input required type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]" /></label><label className="block text-sm font-medium text-[#51485c]">Confirm New Master Password<input required type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]" /></label>{(formError || masterPasswordError) && <p className="text-sm text-[#b34d63]" role="alert">{formError ?? masterPasswordError}</p>}{message && <p className="text-sm text-[#4d7a62]" role="status">{message}</p>}<button type="submit" disabled={isDeriving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7354d6] px-5 text-sm font-semibold text-white hover:bg-[#6042bd] disabled:opacity-50"><Save size={16} />{isDeriving ? "Deriving keys..." : "Change Master Password"}</button></form></section><section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-semibold text-[#3c3348]">Emergency Recovery Kit</h2><p className="mt-1 text-sm leading-5 text-[#837b8e]">Regenerating the key requires your current Master Password. The new key is shown only after the existing vault key is verified.</p><label className="mt-5 block text-sm font-medium text-[#51485c]">Current Master Password<input type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} autoComplete="current-password" className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]" /></label><button type="button" onClick={() => void rotateRecoveryKey()} disabled={isDeriving} className="mt-4 h-11 rounded-xl border border-[#ded7e8] px-5 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff] disabled:opacity-50">Regenerate Recovery Key</button>{(recoveryError || recoveryMessage) && <p className={`mt-3 text-sm ${recoveryError ? "text-[#b34d63]" : "text-[#4d7a62]"}`} role={recoveryError ? "alert" : "status"}>{recoveryError ?? recoveryMessage}</p>}</section></div>;
}
