/// <reference lib="webworker" />

import { argon2id } from "hash-wasm";

type DeriveMessage = {
  type: "derive";
  password: string;
  salt: ArrayBuffer;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<DeriveMessage>) => {
  if (event.data.type !== "derive") return;

  let password = event.data.password;
  const salt = new Uint8Array(event.data.salt);

  try {
    const derived = await argon2id({
      password,
      salt,
      memorySize: event.data.memoryKiB,
      iterations: event.data.iterations,
      parallelism: event.data.parallelism,
      hashLength: event.data.hashLength,
      outputType: "binary",
    });

    if (typeof derived === "string") throw new Error("Argon2id returned an unexpected format");
    workerScope.postMessage({ type: "complete", key: derived.buffer }, [derived.buffer]);
  } catch {
    workerScope.postMessage({ type: "error", message: "Key derivation failed" });
  } finally {
    password = "";
    salt.fill(0);
  }
};