export const CRYPTO_VERSION = 1;

export type Argon2idParameters = {
  algorithm: "Argon2id";
  version: 1;
  salt: string;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
  passwordEncoding: "UTF-8-NFKC";
};

export type DerivationStatus = "starting" | "deriving" | "complete";

export type WrappedVaultKey = {
  cryptoVersion: typeof CRYPTO_VERSION;
  ciphertext: string;
  iv: string;
};

export type BenchmarkResult = {
  samples: number[];
  averageMs: number;
  minimumMs: number;
  maximumMs: number;
  hardwareConcurrency: number | null;
};