"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { wipeBytes } from "@/lib/crypto/encoding";
import {
  createAdditionalData,
  createArgon2idParameters,
  decryptVaultItem,
  deriveMasterKey,
  encryptVaultItem,
  generateSalt,
  generateVaultEncryptionKey,
  unwrapVaultEncryptionKey,
  wrapVaultEncryptionKey,
} from "@/lib/crypto/vault-crypto";
import type { Argon2idParameters } from "@/lib/crypto/types";

type VaultStatus = "loading" | "needs-setup" | "locked" | "unlocked" | "error";

type VaultProfile = {
  kdf: {
    algorithm: string;
    salt: string;
    parameters: Record<string, string | number | boolean>;
  };
  wrappedVaultKey: string;
  wrapIv: string;
  cryptoVersion: number;
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
    if (status !== "unlocked" || !userId) return;
    let timer: number | undefined;
    const resetTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (vaultKeyRef.current) wipeBytes(vaultKeyRef.current);
        vaultKeyRef.current = null;
        setError(null);
        setStatus("locked");
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
    void recordActivity("vault_locked");
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
    const additionalData = createAdditionalData(userId, "vault-key", parameters.version);
    let derivedKey: Uint8Array | null = null;
    let transferredVaultKey = false;

    try {
      derivedKey = await deriveMasterKey(password, parameters);
      const wrapped = await wrapVaultEncryptionKey(
        vaultKey,
        derivedKey,
        additionalData,
      );
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
        }),
      });
      if (!response.ok) throw new Error("Unable to save vault settings");

      vaultKeyRef.current = vaultKey;
      transferredVaultKey = true;
      setStatus("unlocked");
      void recordActivity("vault_created");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to set up vault");
      return false;
    } finally {
      wipeBytes(salt);
      wipeBytes(additionalData);
      if (!transferredVaultKey) wipeBytes(vaultKey);
      if (derivedKey) wipeBytes(derivedKey);
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
      const saveResponse = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kdf: { algorithm: nextParameters.algorithm, salt: nextParameters.salt, parameters: { version: nextParameters.version, memoryKiB: nextParameters.memoryKiB, iterations: nextParameters.iterations, parallelism: nextParameters.parallelism, hashLength: nextParameters.hashLength, passwordEncoding: nextParameters.passwordEncoding } }, wrappedVaultKey: wrapped.ciphertext, wrapIv: wrapped.iv, cryptoVersion: wrapped.cryptoVersion }),
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
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) throw new Error("useVault must be used inside VaultProvider");
  return context;
}