"use client";

import { FormEvent, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  HardDriveDownload,
  LockKeyhole,
  Printer,
  RefreshCw,
  Save,
  Upload,
  X,
} from "lucide-react";

import { useVault } from "@/context/vault-provider";
import {
  parseAndValidateBackup,
  triggerBackupDownload,
  type PassEndBackupFile,
  type RestoreProgress,
  type RestoreSummary,
} from "@/lib/backup/backup-service";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function VaultSettings() {
  const {
    autoLockMinutes,
    setAutoLockMinutes,
    changeMasterPassword,
    regenerateRecoveryKey,
    isDeriving,
    lockVault,
    exportBackup,
    restoreBackup,
  } = useVault();

  // Master password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [masterPasswordError, setMasterPasswordError] = useState<string | null>(null);

  // Recovery kit state
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [confirmRegenerateWarning, setConfirmRegenerateWarning] = useState(false);
  const [newlyRegeneratedKey, setNewlyRegeneratedKey] = useState<string | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Backup export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Backup restore state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<PassEndBackupFile | null>(null);
  const [selectedFileInfo, setSelectedFileInfo] = useState<{ name: string; sizeFormatted: string } | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [sourceCredentialType, setSourceCredentialType] = useState<"password" | "recoveryKey">("password");
  const [sourcePassword, setSourcePassword] = useState("");
  const [sourceRecoveryKey, setSourceRecoveryKey] = useState("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

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
    if (!confirmRegenerateWarning) {
      setRecoveryError("Please confirm that you understand your old recovery key will stop working.");
      return;
    }
    if (!recoveryPassword) {
      setRecoveryError("Enter your current Master Password to create a new Recovery Key.");
      return;
    }

    const newKey = await regenerateRecoveryKey(recoveryPassword);
    if (newKey) {
      setRecoveryPassword("");
      setConfirmRegenerateWarning(false);
      setNewlyRegeneratedKey(newKey);
      setRecoveryMessage("New Recovery Key created. Please save it now.");
    } else {
      setRecoveryError("Incorrect Master Password or unable to create a new key.");
    }
  }

  function downloadEmergencyKit(key: string) {
    const content = `PassEnd Pro Emergency Recovery Kit\n\nRecovery Key:\n${key}\n\nIMPORTANT:\n- Keep this key in a safe, private place.\n- Your old recovery key no longer works.\n- PassEnd cannot recover your account if you lose both your Master Password and this key.\nCreated: ${new Date().toLocaleDateString()}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "passend-emergency-recovery-kit.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyKeyToClipboard(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedRecoveryKey(true);
      setTimeout(() => setCopiedRecoveryKey(false), 2000);
    } catch {
      // Fallback or ignore
    }
  }

  async function handleExportBackup() {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const backup = await exportBackup();
      triggerBackupDownload(backup);
      setExportSuccess(
        `Encrypted backup downloaded: ${backup.manifest.itemCount} item(s) exported at ${new Date().toLocaleTimeString()}.`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export vault backup.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type extension
    if (!file.name.endsWith(".passend") && !file.name.endsWith(".json")) {
      setRestoreError("Invalid file type: Please select a valid .passend or .json backup archive.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const fileSizeFormatted = formatFileSize(file.size);
    const fileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const backup = parseAndValidateBackup(text);
        setSelectedBackup(backup);
        setSelectedFileInfo({ name: fileName, sizeFormatted: fileSizeFormatted });
        setRestoreModalOpen(true);
        setRestoreError(null);
        setRestoreSummary(null);
        setSourcePassword("");
        setSourceRecoveryKey("");
        setRestoreMode("merge");
        setConfirmReplace(false);
      } catch (err) {
        setRestoreError(err instanceof Error ? err.message : "Failed to parse backup file.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setRestoreError("Failed to read the selected backup file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  async function handleExecuteRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBackup) return;

    if (sourceCredentialType === "password" && !sourcePassword) {
      setRestoreError("Please enter the Master Password for this backup.");
      return;
    }
    if (sourceCredentialType === "recoveryKey" && !sourceRecoveryKey) {
      setRestoreError("Please enter the Recovery Key for this backup.");
      return;
    }

    if (restoreMode === "replace" && !confirmReplace) {
      setRestoreError("Please check the box to confirm replacing your vault.");
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreProgress({
      stage: "deriving_key",
      current: 0,
      total: selectedBackup.items.length,
      message: "Preparing restore...",
    });

    try {
      const summary = await restoreBackup({
        backup: selectedBackup,
        credential: {
          password: sourceCredentialType === "password" ? sourcePassword : undefined,
          recoveryKey: sourceCredentialType === "recoveryKey" ? sourceRecoveryKey.replace(/\s+/g, "").toUpperCase() : undefined,
        },
        mode: restoreMode,
        onProgress: (p) => setRestoreProgress(p),
      });

      setRestoreSummary(summary);
      setSourcePassword("");
      setSourceRecoveryKey("");
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore backup.");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Vault lock settings */}
      <section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee9ff] text-[#7354d6]">
            <LockKeyhole size={19} />
          </span>
          <div>
            <h2 className="font-semibold text-[#3c3348]">Vault lock</h2>
            <p className="mt-1 text-sm leading-5 text-[#837b8e]">
              Locks automatically when inactive to keep your data safe.
            </p>
          </div>
        </div>
        <label className="mt-5 block text-sm font-medium text-[#51485c]" htmlFor="auto-lock">
          Auto-lock after
        </label>
        <select
          id="auto-lock"
          value={autoLockMinutes}
          onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
          className="mt-2 h-11 w-40 rounded-xl border border-[#ded7e8] bg-white px-2 text-sm text-[#51485c] outline-none focus:ring-2 focus:ring-[#c6b7ef] sm:max-w-xs"
        >
          <option value={5}>5 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
        </select>
        <button
          type="button"
          onClick={lockVault}
          className="mt-2 mx-3 inline-flex h-10 py-[1.3rem] items-center gap-2 rounded-xl border border-[#ded7e8] px-4 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff]"
        >
          <LockKeyhole size={16} />
          Lock now
        </button>
      </section>

      {/* Change master password */}
      <section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold text-[#3c3348]">Change Master Password</h2>
        <p className="mt-1 text-sm leading-5 text-[#837b8e]">
          Update your password anytime. All your saved items remain secure.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-[#51485c]">
            Current Master Password
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]"
            />
          </label>
          <label className="block text-sm font-medium text-[#51485c]">
            New Master Password
            <input
              required
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]"
            />
          </label>
          <label className="block text-sm font-medium text-[#51485c]">
            Confirm New Master Password
            <input
              required
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]"
            />
          </label>
          {(formError || masterPasswordError) && (
            <p className="text-sm text-[#b34d63]" role="alert">
              {formError ?? masterPasswordError}
            </p>
          )}
          {message && (
            <p className="text-sm text-[#4d7a62]" role="status">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={isDeriving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7354d6] px-5 text-sm font-semibold text-white hover:bg-[#6042bd] disabled:opacity-50"
          >
            <Save size={16} />
            {isDeriving ? "Deriving keys..." : "Change Master Password"}
          </button>
        </form>
      </section>

      {/* Emergency recovery kit regeneration */}
      <section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold text-[#3c3348]">Emergency Recovery Kit</h2>
        <p className="mt-1 text-sm leading-5 text-[#837b8e]">
          Used to regain access to your vault if you ever forget your Master Password.
        </p>

        {/* Confirmation & Invalidation Warning */}
        <div className="mt-4 rounded-xl border border-[#eedab4] bg-[#fffaf0] p-3 text-xs text-[#8a5d24]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b97a29]" />
            <div>
              <p className="font-semibold text-[#7d5118]">Important Warning</p>
              <p className="mt-0.5 leading-relaxed text-[#8a5d24]">
                Creating a new key will instantly disable your old one. Any old copies you saved will no longer work.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-[#51485c]">
            Current Master Password
            <input
              type="password"
              value={recoveryPassword}
              onChange={(event) => setRecoveryPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter Master Password to confirm"
              className="mt-2 h-11 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]"
            />
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#51485c]">
            <input
              type="checkbox"
              checked={confirmRegenerateWarning}
              onChange={(e) => setConfirmRegenerateWarning(e.target.checked)}
              disabled={isDeriving}
              className="mt-0.5 h-4 w-4 rounded border-[#ded7e8] text-[#7354d6] focus:ring-[#c6b7ef]"
            />
            <span>
              I understand that my old recovery key will stop working immediately.
            </span>
          </label>

          <button
            type="button"
            onClick={() => void rotateRecoveryKey()}
            disabled={isDeriving || !confirmRegenerateWarning || !recoveryPassword}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#ded7e8] px-5 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff] disabled:opacity-50"
          >
            {isDeriving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            {isDeriving ? "Verifying..." : "Generate New Recovery Key"}
          </button>
        </div>

        {(recoveryError || recoveryMessage) && (
          <p
            className={`mt-3 text-sm ${recoveryError ? "text-[#b34d63]" : "text-[#4d7a62]"}`}
            role={recoveryError ? "alert" : "status"}
          >
            {recoveryError ?? recoveryMessage}
          </p>
        )}
      </section>

      {/* Newly Regenerated Key Modal Display */}
      {newlyRegeneratedKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-recovery-key-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#e8e4ef] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#f2eefb] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eee9ff] text-[#7354d6]">
                  <CheckCircle2 size={16} />
                </span>
                <h3 id="new-recovery-key-title" className="font-semibold text-[#3c3348]">
                  New Emergency Recovery Key Generated
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewlyRegeneratedKey(null)}
                className="rounded-lg p-1 text-[#837b8e] hover:bg-[#f2eefb] hover:text-[#3c3348]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#eedab4] bg-[#fffaf0] p-3 text-xs text-[#8a5d24]">
                <strong>Important:</strong> Your old key no longer works. Save this new key in a safe place. PassEnd cannot recover your account without it.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#51485c] mb-1.5">
                  Your New Recovery Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="block flex-1 rounded-xl bg-[#f7f4ff] p-3 text-center font-mono text-sm font-semibold tracking-wider text-[#4c388f] select-all break-all">
                    {newlyRegeneratedKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyKeyToClipboard(newlyRegeneratedKey)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#ded7e8] bg-white text-[#6245b8] hover:bg-[#f7f3ff]"
                    title="Copy Key"
                  >
                    {copiedRecoveryKey ? <Check size={16} className="text-[#3b8c56]" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => downloadEmergencyKit(newlyRegeneratedKey)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ded7e8] bg-white px-4 text-xs font-semibold text-[#6245b8] hover:bg-[#f7f3ff]"
                >
                  <Download size={14} />
                  Download Kit (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ded7e8] bg-white px-4 text-xs font-semibold text-[#6245b8] hover:bg-[#f7f3ff]"
                >
                  <Printer size={14} />
                  Print Kit
                </button>
              </div>

              <div className="pt-3 border-t border-[#f2eefb]">
                <button
                  type="button"
                  onClick={() => setNewlyRegeneratedKey(null)}
                  className="w-full rounded-xl bg-[#7354d6] py-2.5 text-xs font-semibold text-white hover:bg-[#6042bd]"
                >
                  I have safely saved my new Recovery Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 13.2: Data Portability & Encrypted Backup (.passend) */}
      <section className="rounded-2xl border border-[#e8e4ef] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee9ff] text-[#7354d6]">
            <HardDriveDownload size={19} />
          </span>
          <div>
            <h2 className="font-semibold text-[#3c3348]">Backup & Restore</h2>
            <p className="mt-1 text-sm leading-5 text-[#837b8e]">
              Save a backup copy of your vault or restore one anytime.
            </p>
          </div>
        </div>

        {/* Warning callout */}
        <div className="mt-4 rounded-xl border border-[#eedab4] bg-[#fffaf0] p-3 text-xs text-[#8a5d24]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b97a29]" />
            <div>
              <p className="font-semibold text-[#7d5118]">Keep Your Backup Safe</p>
              <p className="mt-0.5 leading-relaxed text-[#8a5d24]">
                Anyone with this backup file could try guessing your password to open it. Use a strong Master Password and store your backup file in a safe place.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Export Box */}
          <div className="flex flex-col justify-between rounded-xl border border-[#ded7e8] bg-[#faf9fc] p-4">
            <div>
              <h3 className="font-semibold text-[#3c3348]">Export Backup</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#837b8e]">
                Download a protected copy of your passwords and notes to your device.
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleExportBackup()}
                disabled={isExporting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#7354d6] px-4 text-sm font-semibold text-white hover:bg-[#6042bd] disabled:opacity-50"
              >
                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download size={16} />}
                {isExporting ? "Creating Backup..." : "Export .passend Backup"}
              </button>

              {/* Export Success State */}
              {exportSuccess && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#c4e3cb] bg-[#f4faf5] p-2.5 text-xs text-[#2f6340]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3b8c56]" />
                  <span>{exportSuccess}</span>
                </div>
              )}

              {/* Export Error State */}
              {exportError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f5b8c4] bg-[#fff5f7] p-2.5 text-xs text-[#a03a51]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b34d63]" />
                  <span>{exportError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Restore Box */}
          <div className="flex flex-col justify-between rounded-xl border border-[#ded7e8] bg-[#faf9fc] p-4">
            <div>
              <h3 className="font-semibold text-[#3c3348]">Restore from Backup</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#837b8e]">
                Upload a <code className="font-mono">.passend</code> file to restore items into your vault.
              </p>
            </div>
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".passend,.json"
                onChange={handleFileSelect}
                className="hidden"
                id="passend-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#ded7e8] bg-white px-4 text-sm font-semibold text-[#6245b8] hover:bg-[#f7f3ff]"
              >
                <Upload size={16} />
                Select .passend Backup File
              </button>
              {restoreError && !restoreModalOpen && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f5b8c4] bg-[#fff5f7] p-2.5 text-xs text-[#a03a51]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b34d63]" />
                  <span>{restoreError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Restore Modal Dialog */}
      {restoreModalOpen && selectedBackup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#e8e4ef] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f2eefb] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eee9ff] text-[#7354d6]">
                  <Upload size={16} />
                </span>
                <h3 id="restore-modal-title" className="font-semibold text-[#3c3348]">
                  Restore Encrypted Vault Backup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                disabled={isRestoring}
                className="rounded-lg p-1 text-[#837b8e] hover:bg-[#f2eefb] hover:text-[#3c3348] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {restoreSummary ? (
              /* Completed summary */
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#c4e3cb] bg-[#f4faf5] p-4 text-sm text-[#2f6340]">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-[#3b8c56]" />
                    <span>Backup Restored Successfully!</span>
                  </div>
                  <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-[#41694f]">
                    <li>Mode: <strong>{restoreSummary.mode === "merge" ? "Merge" : "Replace"}</strong></li>
                    <li>Items in backup: <strong>{restoreSummary.totalInBackup}</strong></li>
                    <li>Successfully imported: <strong>{restoreSummary.imported}</strong></li>
                    <li>Exact duplicates skipped: <strong>{restoreSummary.duplicatesSkipped}</strong></li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRestoreModalOpen(false);
                    setSelectedBackup(null);
                    setSelectedFileInfo(null);
                    setRestoreSummary(null);
                  }}
                  className="w-full rounded-xl bg-[#7354d6] py-2.5 text-sm font-semibold text-white hover:bg-[#6042bd]"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Restore configuration form */
              <form onSubmit={handleExecuteRestore} className="mt-4 space-y-4">
                {/* Backup Metadata Card - Complete Transparency */}
                <div className="rounded-xl border border-[#ded7e8] bg-[#faf9fc] p-3 text-xs text-[#51485c] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#837b8e]">File Name:</span>
                    <span className="font-medium truncate max-w-[220px]" title={selectedFileInfo?.name}>
                      {selectedFileInfo?.name ?? "archive.passend"}
                    </span>
                  </div>
                  {selectedFileInfo?.sizeFormatted && (
                    <div className="flex justify-between">
                      <span className="text-[#837b8e]">File Size:</span>
                      <span>{selectedFileInfo.sizeFormatted}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#837b8e]">Archive Format:</span>
                    <span className="font-mono">{selectedBackup.manifest.format} v{selectedBackup.manifest.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#837b8e]">Items in Backup:</span>
                    <span className="font-semibold text-[#7354d6]">{selectedBackup.manifest.itemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#837b8e]">Exported:</span>
                    <span>{new Date(selectedBackup.manifest.exportedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#837b8e]">Source Account:</span>
                    <span className="font-mono truncate max-w-[200px]">{selectedBackup.profile.sourceAccountId}</span>
                  </div>
                </div>

                {/* Authentication Credential */}
                <div>
                  <label className="block text-xs font-semibold text-[#51485c] mb-1.5">
                    Source Authentication Credential
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSourceCredentialType("password")}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                        sourceCredentialType === "password"
                          ? "border-[#7354d6] bg-[#f7f3ff] text-[#7354d6]"
                          : "border-[#ded7e8] bg-white text-[#837b8e] hover:bg-[#faf9fc]"
                      }`}
                    >
                      Master Password
                    </button>
                    {selectedBackup.profile.recoveryWrappedVaultKey && (
                      <button
                        type="button"
                        onClick={() => setSourceCredentialType("recoveryKey")}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                          sourceCredentialType === "recoveryKey"
                            ? "border-[#7354d6] bg-[#f7f3ff] text-[#7354d6]"
                            : "border-[#ded7e8] bg-white text-[#837b8e] hover:bg-[#faf9fc]"
                        }`}
                      >
                        Recovery Key
                      </button>
                    )}
                  </div>

                  {sourceCredentialType === "password" ? (
                    <input
                      type="password"
                      placeholder="Source Vault Master Password"
                      value={sourcePassword}
                      onChange={(e) => setSourcePassword(e.target.value)}
                      disabled={isRestoring}
                      required
                      className="h-10 w-full rounded-xl border border-[#ded7e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6b7ef]"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Source Emergency Recovery Key (e.g. xxxx-xxxx-...)"
                      value={sourceRecoveryKey}
                      onChange={(e) => setSourceRecoveryKey(e.target.value)}
                      disabled={isRestoring}
                      required
                      className="h-10 w-full font-mono rounded-xl border border-[#ded7e8] px-3 text-xs outline-none focus:ring-2 focus:ring-[#c6b7ef]"
                    />
                  )}
                  <p className="mt-1 text-[11px] text-[#837b8e]">
                    Checked only on your device to open the file. Never sent to our servers.
                  </p>
                </div>

                {/* Restore Strategy: Merge vs Replace */}
                <div>
                  <label className="block text-xs font-semibold text-[#51485c] mb-1.5">
                    How to Restore
                  </label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                        restoreMode === "merge"
                          ? "border-[#7354d6] bg-[#f7f3ff]"
                          : "border-[#ded7e8] bg-white hover:bg-[#faf9fc]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === "merge"}
                        onChange={() => setRestoreMode("merge")}
                        disabled={isRestoring}
                        className="mt-0.5 text-[#7354d6]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#3c3348]">Add to current vault (Recommended)</p>
                        <p className="text-[11px] text-[#837b8e]">
                          Keeps all your current items and adds new items from the backup. Skips items that already exist.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                        restoreMode === "replace"
                          ? "border-[#b34d63] bg-[#fff5f7]"
                          : "border-[#ded7e8] bg-white hover:bg-[#faf9fc]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="replace"
                        checked={restoreMode === "replace"}
                        onChange={() => setRestoreMode("replace")}
                        disabled={isRestoring}
                        className="mt-0.5 text-[#b34d63]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#b34d63]">Replace entire vault</p>
                        <p className="text-[11px] text-[#837b8e]">
                          Deletes all current items and restores this backup in their place.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Explicit confirmation for Replace mode */}
                {restoreMode === "replace" && (
                  <div className="rounded-xl border border-[#f5b8c4] bg-[#fff5f7] p-3 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-[#a03a51]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b34d63]" />
                      <p className="leading-relaxed">
                        <strong>Warning:</strong> This will permanently delete all your existing items. This cannot be undone.
                      </p>
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer text-xs text-[#a03a51] pt-1">
                      <input
                        type="checkbox"
                        checked={confirmReplace}
                        onChange={(e) => setConfirmReplace(e.target.checked)}
                        disabled={isRestoring}
                        className="mt-0.5 h-4 w-4 rounded border-[#f5b8c4] text-[#b34d63]"
                      />
                      <span className="font-semibold">
                        I understand that my current vault items will be permanently deleted.
                      </span>
                    </label>
                  </div>
                )}

                {/* Progress bar and stage message */}
                {restoreProgress && (
                  <div className="rounded-xl border border-[#e8e4ef] bg-[#faf9fc] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#51485c]">{restoreProgress.message}</span>
                      <span className="font-mono text-[#7354d6]">
                        {restoreProgress.total > 0
                          ? `${Math.round((restoreProgress.current / restoreProgress.total) * 100)}%`
                          : ""}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e4ef]">
                      <div
                        className="h-full bg-[#7354d6] transition-all duration-300"
                        style={{
                          width: `${
                            restoreProgress.total > 0
                              ? Math.min(100, Math.round((restoreProgress.current / restoreProgress.total) * 100))
                              : 10
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {restoreError && (
                  <div className="flex items-start gap-2 rounded-xl border border-[#f5b8c4] bg-[#fff5f7] p-3 text-xs text-[#a03a51]" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b34d63]" />
                    <span className="leading-relaxed">{restoreError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-[#f2eefb]">
                  <button
                    type="button"
                    onClick={() => setRestoreModalOpen(false)}
                    disabled={isRestoring}
                    className="rounded-xl border border-[#ded7e8] px-4 py-2 text-xs font-semibold text-[#837b8e] hover:bg-[#faf9fc] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRestoring || (restoreMode === "replace" && !confirmReplace)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#7354d6] px-5 py-2 text-xs font-semibold text-white hover:bg-[#6042bd] disabled:opacity-50"
                  >
                    {isRestoring && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    {isRestoring ? "Restoring Vault..." : "Start Restore"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
