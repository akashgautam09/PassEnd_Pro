"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { hexToBytes, wipeBytes } from "@/lib/crypto/encoding";
import { broadcastVaultEvent, subscribeToVaultEvents } from "@/lib/sync/tab-channel";
import {
  buildBackupPackage,
  type PassEndBackupFile,
  type PassEndBackupItem,
  type PassEndBackupProfile,
  type RestoreProgress,
  type RestoreSummary,
  restoreEncryptedBackup as executeRestore,
} from "@/lib/backup/backup-service";
import { getItemType, type VaultItemPayload } from "@/lib/types/vault";
import {
  createAdditionalData,
  createArgon2idParameters,
  decryptVaultItem,
  deriveMasterKey,
  encryptVaultItem,
  formatRecoveryKey,
  generateRecoveryKey,
  generateSalt,
  generateVaultEncryptionKey,
  unwrapVaultEncryptionKey,
  unwrapVaultKeyWithRecoveryKey,
  wrapVaultKeyWithRecoveryKey,
  wrapVaultEncryptionKey,
} from "@/lib/crypto/vault-crypto";
import type { Argon2idParameters } from "@/lib/crypto/types";

type VaultStatus = "loading" | "needs-setup" | "recovery-confirmation" | "locked" | "unlocked" | "error";

type VaultProfile = {
  kdf: {
    algorithm: string;
    salt: string;
    parameters: Record<string, string | number | boolean>;
  };
  wrappedVaultKey: string;
  wrapIv: string;
  cryptoVersion: number;
  recoveryWrappedVaultKey?: string;
  recoveryWrapIv?: string;
  recoveryCryptoVersion?: number;
};

type VaultContextValue = {
  status: VaultStatus;
  isDeriving: boolean;
  error: string | null;
  setupVault: (password: string) => Promise<boolean>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => void;
  encryptItem: (itemId: string, payload: unknown) => Promise<{ encryptedData: string; iv: string; cryptoVersion: 1 }>;
  decryptItem: <T>(itemId: string, encrypted: { encryptedData: string; iv: string; cryptoVersion: 1 }) => Promise<T>;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  changeMasterPassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  recoveryKey: string | null;
  confirmRecoveryKeySaved: () => void;
  recoverVault: (recoveryKey: string, nextPassword: string) => Promise<boolean>;
  regenerateRecoveryKey: (currentPassword: string) => Promise<string | null>;
  notifyMutation: (action?: "created" | "updated" | "trashed" | "restored" | "deleted", itemId?: string) => void;
  exportBackup: () => Promise<PassEndBackupFile>;
  restoreBackup: (params: {
    backup: PassEndBackupFile;
    credential: { password?: string; recoveryKey?: string };
    mode: "merge" | "replace";
    onProgress?: (progress: RestoreProgress) => void;
  }) => Promise<RestoreSummary>;
};

const VaultContext = createContext<VaultContextValue | null>(null);

function isProfile(value: unknown): value is VaultProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<VaultProfile>;
  return Boolean(
    profile.kdf &&
      typeof profile.kdf === "object" &&
      typeof profile.kdf.algorithm === "string" &&
      typeof profile.kdf.salt === "string" &&
      profile.kdf.parameters &&
      typeof profile.kdf.parameters === "object" &&
      typeof profile.wrappedVaultKey === "string" &&
      typeof profile.wrapIv === "string" &&
      typeof profile.cryptoVersion === "number",
  );
}

function toArgon2idParameters(profile: VaultProfile): Argon2idParameters {
  if (profile.kdf.algorithm !== "Argon2id") throw new Error("Unsupported vault key derivation algorithm");
  if (Number(profile.kdf.parameters.version) !== 1) throw new Error("Unsupported vault key derivation version");
  return {
    algorithm: "Argon2id",
    salt: profile.kdf.salt,
    version: 1,
    memoryKiB: Number(profile.kdf.parameters.memoryKiB),
    iterations: Number(profile.kdf.parameters.iterations),
    parallelism: Number(profile.kdf.parameters.parallelism),
    hashLength: Number(profile.kdf.parameters.hashLength),
    passwordEncoding: "UTF-8-NFKC",
  };
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [isDeriving, setIsDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [autoLockMinutes, setAutoLockMinutesState] = useState(() => {
    if (typeof window === "undefined") return 15;
    const stored = Number(window.localStorage.getItem("passend:auto-lock-minutes"));
    return [5, 15, 30, 60].includes(stored) ? stored : 15;
  });
  const vaultKeyRef = useRef<Uint8Array | null>(null);

  function setAutoLockMinutes(minutes: number) {
    if (![5, 15, 30, 60].includes(minutes)) return;
    setAutoLockMinutesState(minutes);
    window.localStorage.setItem("passend:auto-lock-minutes", String(minutes));
  }

  const recordActivity = useCallback(async (eventType: string) => {
    if (!userId) return;
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType }),
    }).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
    vaultKeyRef.current = null;
    if (!isLoaded || !userId) return;

    let cancelled = false;
    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load vault profile");
        const body = (await response.json()) as { profile: VaultProfile | null };
        if (!cancelled) setStatus(body.profile && isProfile(body.profile) ? "locked" : "needs-setup");
      } catch {
        if (!cancelled) {
          setError("Unable to load vault settings. Try again shortly.");
          setStatus("error");
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId]);

  useEffect(() => {
    const unsubscribe = subscribeToVaultEvents((event) => {
      if (event.type === "VAULT_LOCKED" || event.type === "SESSION_SIGNED_OUT") {
        if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
        vaultKeyRef.current = null;
        setError(null);
        setStatus("locked");
      }
    });
    return unsubscribe;
  }, []);

  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (previousUserIdRef.current && !userId) {
      broadcastVaultEvent({ type: "SESSION_SIGNED_OUT" });
      if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
      vaultKeyRef.current = null;
      setStatus("locked");
    }
    previousUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (status !== "unlocked" || !userId) return;
    let timer: number | undefined;
    const resetTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
        vaultKeyRef.current = null;
        setError(null);
        setStatus("locked");
        broadcastVaultEvent({ type: "VAULT_LOCKED" });
        void recordActivity("vault_locked");
      }, autoLockMinutes * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [autoLockMinutes, recordActivity, status, userId]);

  useEffect(() => {
    return () => {
      if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
      vaultKeyRef.current = null;
    };
  }, []);

  function lockVault() {
    if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
    vaultKeyRef.current = null;
    setError(null);
    setStatus("locked");
    broadcastVaultEvent({ type: "VAULT_LOCKED" });
    void recordActivity("vault_locked");
  }

  function notifyMutation(action?: "created" | "updated" | "trashed" | "restored" | "deleted", itemId?: string) {
    broadcastVaultEvent({ type: "VAULT_MUTATED", action, itemId });
  }

  async function encryptItem(itemId: string, payload: unknown) {
    if (!userId || !vaultKeyRef.current) throw new Error("Vault is locked");
    return encryptVaultItem(payload, vaultKeyRef.current, userId, itemId);
  }

  async function decryptItem<T>(itemId: string, encrypted: { encryptedData: string; iv: string; cryptoVersion: 1 }) {
    if (!userId || !vaultKeyRef.current) throw new Error("Vault is locked");
    return decryptVaultItem<T>(encrypted, vaultKeyRef.current, userId, itemId);
  }

  async function setupVault(password: string): Promise<boolean> {
    if (!userId || isDeriving) return false;
    setError(null);
    setIsDeriving(true);
    const salt = generateSalt();
    const parameters = createArgon2idParameters(salt);
    const vaultKey = generateVaultEncryptionKey();
    const rawRecoveryKey = generateRecoveryKey();
    const additionalData = createAdditionalData(userId, "vault-key", parameters.version);
    const recoveryAdditionalData = createAdditionalData(userId, "recovery-key-wrap", parameters.version);
    let derivedKey: Uint8Array | null = null;
    let transferredVaultKey = false;

    try {
      derivedKey = await deriveMasterKey(password, parameters);
      const wrapped = await wrapVaultEncryptionKey(
        vaultKey,
        derivedKey,
        additionalData,
      );
      const recoveryWrapped = await wrapVaultKeyWithRecoveryKey(vaultKey, rawRecoveryKey, recoveryAdditionalData);
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kdf: {
            algorithm: parameters.algorithm,
            salt: parameters.salt,
            parameters: {
              version: parameters.version,
              memoryKiB: parameters.memoryKiB,
              iterations: parameters.iterations,
              parallelism: parameters.parallelism,
              hashLength: parameters.hashLength,
              passwordEncoding: parameters.passwordEncoding,
            },
          },
          wrappedVaultKey: wrapped.ciphertext,
          wrapIv: wrapped.iv,
          cryptoVersion: wrapped.cryptoVersion,
          recoveryWrappedVaultKey: recoveryWrapped.ciphertext,
          recoveryWrapIv: recoveryWrapped.iv,
          recoveryCryptoVersion: recoveryWrapped.cryptoVersion,
        }),
      });
      if (!response.ok) throw new Error("Unable to save vault settings");

      vaultKeyRef.current = vaultKey;
      transferredVaultKey = true;
      setRecoveryKey(formatRecoveryKey(rawRecoveryKey));
      setStatus("recovery-confirmation");
      void recordActivity("vault_created");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to set up vault");
      return false;
    } finally {
      wipeBytes(salt);
      wipeBytes(additionalData);
      wipeBytes(recoveryAdditionalData);
      wipeBytes(rawRecoveryKey);
      if (!transferredVaultKey) wipeBytes(vaultKey);
      if (derivedKey) wipeBytes(derivedKey);
      setIsDeriving(false);
    }
  }

  function confirmRecoveryKeySaved() {
    setRecoveryKey(null);
    setStatus("unlocked");
  }

  async function recoverVault(recoveryKeyText: string, nextPassword: string): Promise<boolean> {
    if (!userId || isDeriving) return false;
    setError(null);
    setIsDeriving(true);
    let recoveryBytes: Uint8Array | null = null;
    let recoveredVaultKey: Uint8Array | null = null;
    let nextDerivedKey: Uint8Array | null = null;
    const salt = generateSalt();
    const nextParameters = createArgon2idParameters(salt);
    const nextAdditionalData = createAdditionalData(userId, "vault-key", nextParameters.version);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load vault settings");
      const body = (await response.json()) as { profile: VaultProfile | null };
      if (!body.profile || !isProfile(body.profile) || !body.profile.recoveryWrappedVaultKey || !body.profile.recoveryWrapIv) throw new Error("Recovery is not configured for this vault");
      recoveryBytes = hexToBytes(recoveryKeyText);
      const recoveryAdditionalData = createAdditionalData(userId, "recovery-key-wrap", body.profile.recoveryCryptoVersion ?? 1);
      recoveredVaultKey = await unwrapVaultKeyWithRecoveryKey({ cryptoVersion: (body.profile.recoveryCryptoVersion ?? 1) as 1, ciphertext: body.profile.recoveryWrappedVaultKey, iv: body.profile.recoveryWrapIv }, recoveryBytes, recoveryAdditionalData);
      wipeBytes(recoveryAdditionalData);
      nextDerivedKey = await deriveMasterKey(nextPassword, nextParameters);
      const wrapped = await wrapVaultEncryptionKey(recoveredVaultKey, nextDerivedKey, nextAdditionalData);
      const saveResponse = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kdf: { algorithm: nextParameters.algorithm, salt: nextParameters.salt, parameters: { version: nextParameters.version, memoryKiB: nextParameters.memoryKiB, iterations: nextParameters.iterations, parallelism: nextParameters.parallelism, hashLength: nextParameters.hashLength, passwordEncoding: nextParameters.passwordEncoding } }, wrappedVaultKey: wrapped.ciphertext, wrapIv: wrapped.iv, cryptoVersion: wrapped.cryptoVersion, recoveryWrappedVaultKey: body.profile.recoveryWrappedVaultKey, recoveryWrapIv: body.profile.recoveryWrapIv, recoveryCryptoVersion: body.profile.recoveryCryptoVersion ?? 1 }) });
      if (!saveResponse.ok) throw new Error("Unable to save recovered vault settings");
      vaultKeyRef.current = recoveredVaultKey;
      recoveredVaultKey = null;
      setStatus("unlocked");
      void recordActivity("master_password_changed");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to recover vault");
      return false;
    } finally {
      wipeBytes(salt);
      wipeBytes(nextAdditionalData);
      if (recoveryBytes) wipeBytes(recoveryBytes);
      if (recoveredVaultKey) wipeBytes(recoveredVaultKey);
      if (nextDerivedKey) wipeBytes(nextDerivedKey);
      setIsDeriving(false);
    }
  }

  async function unlockVault(password: string): Promise<boolean> {
    if (!userId || isDeriving) return false;
    setError(null);
    setIsDeriving(true);
    let derivedKey: Uint8Array | null = null;
    let unwrappedVaultKey: Uint8Array | null = null;
    let additionalData: Uint8Array | null = null;
    let failureType: "storage" | "profile" | "decrypt" = "decrypt";

    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) {
        failureType = "storage";
        throw new Error("Unable to load vault settings");
      }
      const body = (await response.json()) as { profile: VaultProfile | null };
      if (!body.profile || !isProfile(body.profile)) {
        failureType = "profile";
        throw new Error("Vault setup is incomplete");
      }

      const parameters = toArgon2idParameters(body.profile);
      derivedKey = await deriveMasterKey(password, parameters);
      additionalData = createAdditionalData(userId, "vault-key", body.profile.cryptoVersion);
      unwrappedVaultKey = await unwrapVaultEncryptionKey(
        {
          cryptoVersion: body.profile.cryptoVersion as 1,
          ciphertext: body.profile.wrappedVaultKey,
          iv: body.profile.wrapIv,
        },
        derivedKey,
        additionalData,
      );
      vaultKeyRef.current = unwrappedVaultKey;
      unwrappedVaultKey = null;
      setStatus("unlocked");
      void recordActivity("vault_unlocked");
      return true;
    } catch {
      if (unwrappedVaultKey) wipeBytes(unwrappedVaultKey);
      if (additionalData) wipeBytes(additionalData);
      setError(
        failureType === "decrypt"
          ? "The Master Password was incorrect or the vault data is invalid."
          : failureType === "profile"
            ? "The vault profile is incomplete. Start vault setup again."
            : "Unable to reach vault storage. Check the database configuration and try again.",
      );
      setStatus("locked");
      return false;
    } finally {
      if (derivedKey) wipeBytes(derivedKey);
      setIsDeriving(false);
    }
  }

  async function changeMasterPassword(currentPassword: string, nextPassword: string): Promise<boolean> {
    if (!userId || !vaultKeyRef.current || isDeriving) return false;
    setError(null);
    setIsDeriving(true);
    let oldDerivedKey: Uint8Array | null = null;
    let nextDerivedKey: Uint8Array | null = null;
    let existingVaultKey: Uint8Array | null = null;
    const salt = generateSalt();
    const nextParameters = createArgon2idParameters(salt);
    const oldAdditionalData = createAdditionalData(userId, "vault-key", 1);
    const nextAdditionalData = createAdditionalData(userId, "vault-key", nextParameters.version);

    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load vault settings");
      const body = (await response.json()) as { profile: VaultProfile | null };
      if (!body.profile || !isProfile(body.profile)) throw new Error("Vault setup is incomplete");
      const oldParameters = toArgon2idParameters(body.profile);
      oldDerivedKey = await deriveMasterKey(currentPassword, oldParameters);
      wipeBytes(oldAdditionalData);
      const profileAdditionalData = createAdditionalData(userId, "vault-key", body.profile.cryptoVersion);
      existingVaultKey = await unwrapVaultEncryptionKey({ cryptoVersion: body.profile.cryptoVersion as 1, ciphertext: body.profile.wrappedVaultKey, iv: body.profile.wrapIv }, oldDerivedKey, profileAdditionalData);
      wipeBytes(profileAdditionalData);
      nextDerivedKey = await deriveMasterKey(nextPassword, nextParameters);
      const wrapped = await wrapVaultEncryptionKey(existingVaultKey, nextDerivedKey, nextAdditionalData);
      const currentProfile = body.profile;
      const saveResponse = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kdf: { algorithm: nextParameters.algorithm, salt: nextParameters.salt, parameters: { version: nextParameters.version, memoryKiB: nextParameters.memoryKiB, iterations: nextParameters.iterations, parallelism: nextParameters.parallelism, hashLength: nextParameters.hashLength, passwordEncoding: nextParameters.passwordEncoding } }, wrappedVaultKey: wrapped.ciphertext, wrapIv: wrapped.iv, cryptoVersion: wrapped.cryptoVersion, recoveryWrappedVaultKey: currentProfile.recoveryWrappedVaultKey, recoveryWrapIv: currentProfile.recoveryWrapIv, recoveryCryptoVersion: currentProfile.recoveryCryptoVersion }),
      });
      if (!saveResponse.ok) throw new Error("Unable to save new Master Password settings");
      setStatus("unlocked");
      void recordActivity("master_password_changed");
      return true;
    } catch {
      setError("The current Master Password was incorrect or the new settings could not be saved.");
      return false;
    } finally {
      wipeBytes(salt);
      wipeBytes(oldAdditionalData);
      wipeBytes(nextAdditionalData);
      if (oldDerivedKey) wipeBytes(oldDerivedKey);
      if (nextDerivedKey) wipeBytes(nextDerivedKey);
      if (existingVaultKey) wipeBytes(existingVaultKey);
      setIsDeriving(false);
    }
  }

  async function regenerateRecoveryKey(currentPassword: string): Promise<string | null> {
    if (!userId || !vaultKeyRef.current || isDeriving) return null;
    setError(null);
    setIsDeriving(true);
    let derivedKey: Uint8Array | null = null;
    let existingVaultKey: Uint8Array | null = null;
    const rawRecoveryKey = generateRecoveryKey();
    const recoveryAdditionalData = createAdditionalData(userId, "recovery-key-wrap", 1);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load vault settings");
      const body = (await response.json()) as { profile: VaultProfile | null };
      if (!body.profile || !isProfile(body.profile)) throw new Error("Vault setup is incomplete");
      const parameters = toArgon2idParameters(body.profile);
      derivedKey = await deriveMasterKey(currentPassword, parameters);
      const oldAdditionalData = createAdditionalData(userId, "vault-key", body.profile.cryptoVersion);
      existingVaultKey = await unwrapVaultEncryptionKey({ cryptoVersion: body.profile.cryptoVersion as 1, ciphertext: body.profile.wrappedVaultKey, iv: body.profile.wrapIv }, derivedKey, oldAdditionalData);
      wipeBytes(oldAdditionalData);
      const wrapped = await wrapVaultKeyWithRecoveryKey(existingVaultKey, rawRecoveryKey, recoveryAdditionalData);
      const verified = await unwrapVaultKeyWithRecoveryKey(wrapped, rawRecoveryKey, recoveryAdditionalData);
      wipeBytes(verified);
      const saveResponse = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kdf: body.profile.kdf, wrappedVaultKey: body.profile.wrappedVaultKey, wrapIv: body.profile.wrapIv, cryptoVersion: body.profile.cryptoVersion, recoveryWrappedVaultKey: wrapped.ciphertext, recoveryWrapIv: wrapped.iv, recoveryCryptoVersion: wrapped.cryptoVersion }) });
      if (!saveResponse.ok) throw new Error("Unable to save Recovery Key settings");
      const formattedKey = formatRecoveryKey(rawRecoveryKey);
      setRecoveryKey(formattedKey);
      void recordActivity("recovery_key_regenerated");
      return formattedKey;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to regenerate Recovery Key");
      return null;
    } finally {
      wipeBytes(rawRecoveryKey);
      wipeBytes(recoveryAdditionalData);
      if (derivedKey) wipeBytes(derivedKey);
      if (existingVaultKey) wipeBytes(existingVaultKey);
      setIsDeriving(false);
    }
  }

  const exportBackup = useCallback(async (): Promise<PassEndBackupFile> => {
    if (!userId || !vaultKeyRef.current) {
      throw new Error("Vault must be unlocked to export a backup.");
    }

    const profileRes = await fetch("/api/profile", { cache: "no-store" });
    if (!profileRes.ok) throw new Error("Failed to load vault profile for backup.");
    const profileData = await profileRes.json();
    if (!profileData.profile) throw new Error("Vault profile not found.");

    const itemsRes = await fetch("/api/vault?trash=all", { cache: "no-store" });
    if (!itemsRes.ok) throw new Error("Failed to load vault items for backup.");
    const itemsData = await itemsRes.json();
    const rawItems = (itemsData.items ?? []) as Array<{
      _id: string;
      encryptedData: string;
      iv: string;
      cryptoVersion: number;
      version: number;
      isFavorite: boolean;
      isTrash: boolean;
      trashedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;

    const backupProfile: PassEndBackupProfile = {
      sourceAccountId: userId,
      kdf: profileData.profile.kdf,
      wrappedVaultKey: profileData.profile.wrappedVaultKey,
      wrapIv: profileData.profile.wrapIv,
      cryptoVersion: profileData.profile.cryptoVersion,
      recoveryWrappedVaultKey: profileData.profile.recoveryWrappedVaultKey,
      recoveryWrapIv: profileData.profile.recoveryWrapIv,
      recoveryCryptoVersion: profileData.profile.recoveryCryptoVersion,
    };

    const backupItems: PassEndBackupItem[] = rawItems.map((item) => ({
      id: item._id,
      encryptedData: item.encryptedData,
      iv: item.iv,
      cryptoVersion: item.cryptoVersion,
      version: item.version,
      isFavorite: item.isFavorite,
      isTrash: item.isTrash,
      trashedAt: item.trashedAt ?? null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(item.createdAt).toISOString(),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date(item.updatedAt).toISOString(),
    }));

    return buildBackupPackage(backupProfile, backupItems);
  }, [userId]);

  const restoreBackup = useCallback(async (params: {
    backup: PassEndBackupFile;
    credential: { password?: string; recoveryKey?: string };
    mode: "merge" | "replace";
    onProgress?: (progress: RestoreProgress) => void;
  }): Promise<RestoreSummary> => {
    if (!userId || !vaultKeyRef.current) {
      throw new Error("Vault must be unlocked to restore a backup.");
    }

    const existingTitles = new Set<string>();
    if (params.mode === "merge") {
      try {
        const itemsRes = await fetch("/api/vault?trash=all", { cache: "no-store" });
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          const items = (itemsData.items ?? []) as Array<{
            _id: string;
            encryptedData: string;
            iv: string;
            cryptoVersion: 1;
          }>;
          for (const item of items) {
            try {
              const payload = await decryptVaultItem<VaultItemPayload>(
                item,
                vaultKeyRef.current,
                userId,
                item._id
              );
              existingTitles.add(`${getItemType(payload)}:${payload.title.trim().toLowerCase()}`);
            } catch {
              // Ignore decryption failure for individual stale or mismatched item
            }
          }
        }
      } catch {
        // Proceed with empty existingTitles
      }
    }

    const summary = await executeRestore({
      backup: params.backup,
      credential: params.credential,
      destinationVaultKey: vaultKeyRef.current,
      destinationAccountId: userId,
      existingItemTitles: existingTitles,
      mode: params.mode,
      onProgress: params.onProgress,
    });

    broadcastVaultEvent({ type: "VAULT_MUTATED", action: "created" });
    return summary;
  }, [userId]);

  const value: VaultContextValue = {
    status,
    isDeriving,
    error,
    setupVault,
    unlockVault,
    lockVault,
    encryptItem,
    decryptItem,
    autoLockMinutes,
    setAutoLockMinutes,
    changeMasterPassword,
    recoveryKey,
    confirmRecoveryKeySaved,
    recoverVault,
    regenerateRecoveryKey,
    notifyMutation,
    exportBackup,
    restoreBackup,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) throw new Error("useVault must be used inside VaultProvider");
  return context;
}