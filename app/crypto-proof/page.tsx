"use client";

import { useState } from "react";

import { wipeBytes } from "@/lib/crypto/encoding";
import {
  benchmarkArgon2id,
  createAdditionalData,
  createArgon2idParameters,
  deriveMasterKey,
  generateSalt,
  generateVaultEncryptionKey,
  unwrapVaultEncryptionKey,
  wrapVaultEncryptionKey,
} from "@/lib/crypto/vault-crypto";
import type { BenchmarkResult, DerivationStatus } from "@/lib/crypto/types";

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export default function CryptoProofPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<DerivationStatus | "idle">("idle");
  const [message, setMessage] = useState("No proof has run yet.");
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);

  async function runProof() {
    if (!password || status === "deriving") return;
    setStatus("starting");
    setMessage("Generating a fresh salt and vault key...");
    setBenchmark(null);

    const salt = generateSalt();
    const parameters = createArgon2idParameters(salt);
    const vaultKey = generateVaultEncryptionKey();
    const aad = createAdditionalData("phase-4-proof", "vault-key", parameters.version);
    let derivedKey: Uint8Array | null = null;
    let wrongKey: Uint8Array | null = null;
    let unwrapped: Uint8Array | null = null;

    try {
      derivedKey = await deriveMasterKey(password, parameters, setStatus);
      setMessage("Wrapping and verifying the vault key...");
      const wrapped = await wrapVaultEncryptionKey(vaultKey, derivedKey, aad);
      unwrapped = await unwrapVaultEncryptionKey(wrapped, derivedKey, aad);
      if (!equalBytes(vaultKey, unwrapped)) throw new Error("Vault key round-trip failed");

      wrongKey = await deriveMasterKey(`${password}-wrong`, parameters);
      let wrongPasswordRejected = false;
      try {
        await unwrapVaultEncryptionKey(wrapped, wrongKey, aad);
      } catch {
        wrongPasswordRejected = true;
      }

      const tampered = { ...wrapped, ciphertext: `${wrapped.ciphertext.slice(0, -2)}AA` };
      let tamperingRejected = false;
      try {
        await unwrapVaultEncryptionKey(tampered, derivedKey, aad);
      } catch {
        tamperingRejected = true;
      }

      if (!wrongPasswordRejected || !tamperingRejected) throw new Error("Authentication failure checks did not reject");
      setMessage(`Passed: round-trip, wrong-password rejection, and tamper rejection. Parameters: ${parameters.memoryKiB} KiB / ${parameters.iterations} passes / p${parameters.parallelism}.`);
      setStatus("complete");
      setPassword("");
    } catch (error) {
      setStatus("idle");
      setMessage(error instanceof Error ? error.message : "Proof failed");
    } finally {
      wipeBytes(salt);
      wipeBytes(vaultKey);
      wipeBytes(aad);
      if (derivedKey) wipeBytes(derivedKey);
      if (wrongKey) wipeBytes(wrongKey);
      if (unwrapped) wipeBytes(unwrapped);
    }
  }

  async function runBenchmark() {
    if (!password || status === "deriving") return;
    setStatus("starting");
    setMessage("Benchmarking three sequential worker derivations...");
    const salt = generateSalt();
    const parameters = createArgon2idParameters(salt);
    try {
      const result = await benchmarkArgon2id(password, parameters);
      setBenchmark(result);
      setMessage("Benchmark complete. These measurements stay in this browser.");
      setStatus("complete");
      setPassword("");
    } catch (error) {
      setStatus("idle");
      setMessage(error instanceof Error ? error.message : "Benchmark failed");
    } finally {
      wipeBytes(salt);
    }
  }

  const isBusy = status === "starting" || status === "deriving";

  return (
    <main className="min-h-screen bg-[#f7f5fb] px-5 py-12 text-[#2e2639] sm:px-8">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#e8e4ef] bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#8066ce]">Phase 4 proof</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Argon2id crypto check</h1>
        <p className="mt-3 text-sm leading-6 text-[#837b8e]">This isolated check runs entirely in a Web Worker. It never saves or sends the password, derived key, salt, or vault key.</p>
        <label className="mt-8 block text-sm font-medium text-[#51485c]" htmlFor="proof-password">Temporary test password</label>
        <input id="proof-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isBusy} className="mt-2 h-12 w-full rounded-xl border border-[#ded7e8] bg-[#fcfbfe] px-4 text-sm outline-none ring-[#c6b7ef] focus:ring-2" autoComplete="off" />
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={runProof} disabled={!password || isBusy} className="h-11 rounded-xl bg-[#7354d6] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#6042bd] disabled:cursor-not-allowed disabled:opacity-50">Run crypto proof</button>
          <button type="button" onClick={runBenchmark} disabled={!password || isBusy} className="h-11 rounded-xl border border-[#ded7e8] px-5 text-sm font-semibold text-[#6245b8] transition-colors hover:bg-[#f7f3ff] disabled:cursor-not-allowed disabled:opacity-50">Benchmark</button>
        </div>
        <div className="mt-7 rounded-xl bg-[#f7f4ff] p-4 text-sm text-[#665b75]" aria-live="polite">
          {isBusy ? "Deriving key in a background worker..." : message}
        </div>
        {benchmark && <p className="mt-4 text-xs leading-5 text-[#8a8295]">Samples: {benchmark.samples.join(" ms, ")} ms. Average: {benchmark.averageMs} ms. Range: {benchmark.minimumMs}-{benchmark.maximumMs} ms. Logical processors: {benchmark.hardwareConcurrency ?? "unknown"}.</p>}
        <p className="mt-8 text-xs leading-5 text-[#a19aaa]">This is a development proof of concept, not a security audit. Production setup will add vault profile persistence and in-memory lock lifecycle.</p>
      </section>
    </main>
  );
}