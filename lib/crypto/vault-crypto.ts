import "client-only";

import type { Argon2idParameters, BenchmarkResult, DerivationStatus, WrappedVaultKey } from "@/lib/crypto/types";
import { base64ToBytes, bytesToBase64, wipeBytes } from "@/lib/crypto/encoding";

const ARGON2_DEFAULTS = {
  memoryKiB: 19 * 1024,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

let activeDerivation: Promise<Uint8Array> | null = null;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return salt;
}

export function generateVaultEncryptionKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

export function createArgon2idParameters(salt: Uint8Array): Argon2idParameters {
  return {
    algorithm: "Argon2id",
    version: 1,
    salt: bytesToBase64(salt),
    ...ARGON2_DEFAULTS,
    passwordEncoding: "UTF-8-NFKC",
  };
}

export async function deriveMasterKey(
  password: string,
  parameters: Argon2idParameters,
  onStatus?: (status: DerivationStatus) => void,
): Promise<Uint8Array> {
  if (activeDerivation) throw new Error("A key derivation is already in progress");

  const worker = new Worker(new URL("./argon2.worker.ts", import.meta.url), { type: "module" });
  const salt = base64ToBytes(parameters.salt);
  const normalizedPassword = password.normalize("NFKC");

  activeDerivation = new Promise<Uint8Array>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ type: string; key?: ArrayBuffer; message?: string }>) => {
      if (event.data.type === "complete" && event.data.key) resolve(new Uint8Array(event.data.key));
      else reject(new Error(event.data.message ?? "Key derivation failed"));
    };
    worker.onerror = () => reject(new Error("Key derivation worker failed"));
    onStatus?.("deriving");
    worker.postMessage(
      {
        type: "derive",
        password: normalizedPassword,
        salt: salt.buffer,
        ...ARGON2_DEFAULTS,
      },
      [salt.buffer],
    );
  });

  try {
    const result = await activeDerivation;
    onStatus?.("complete");
    return result;
  } finally {
    activeDerivation = null;
    worker.terminate();
  }
}

export async function wrapVaultEncryptionKey(
  vaultKey: Uint8Array,
  derivedKey: Uint8Array,
  additionalData: Uint8Array,
): Promise<WrappedVaultKey> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const wrappingKey = await crypto.subtle.importKey("raw", toArrayBuffer(derivedKey), "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(additionalData), tagLength: 128 },
    wrappingKey,
    toArrayBuffer(vaultKey),
  );

  return {
    cryptoVersion: 1,
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function unwrapVaultEncryptionKey(
  wrapped: WrappedVaultKey,
  derivedKey: Uint8Array,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  const wrappingKey = await crypto.subtle.importKey("raw", toArrayBuffer(derivedKey), "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64ToBytes(wrapped.iv)),
      additionalData: toArrayBuffer(additionalData),
      tagLength: 128,
    },
    wrappingKey,
    toArrayBuffer(base64ToBytes(wrapped.ciphertext)),
  );
  return new Uint8Array(decrypted);
}

export function createAdditionalData(accountId: string, scope: "vault-key", cryptoVersion: number): Uint8Array {
  return new TextEncoder().encode(`${accountId}|${scope}|v${cryptoVersion}`);
}

export async function benchmarkArgon2id(
  password: string,
  parameters: Argon2idParameters,
  samples = 3,
): Promise<BenchmarkResult> {
  const durations: number[] = [];

  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    const derivedKey = await deriveMasterKey(password, parameters);
    wipeBytes(derivedKey);
    durations.push(Math.round((performance.now() - started) * 100) / 100);
  }

  return {
    samples: durations,
    averageMs: Math.round((durations.reduce((total, value) => total + value, 0) / durations.length) * 100) / 100,
    minimumMs: Math.min(...durations),
    maximumMs: Math.max(...durations),
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  };
}