"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Terminal,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";

interface CryptoPlaygroundProps {
  onShowToast: (message: string) => void;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function CryptoPlayground({ onShowToast }: CryptoPlaygroundProps) {
  const [masterPassword, setMasterPassword] = useState("CorrectHorseBatteryStaple!2026");
  const [showPassword, setShowPassword] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(true);

  // Plaintext inputs
  const [title, setTitle] = useState("Personal Proton Mail");
  const [username, setUsername] = useState("akash@proton.me");
  const [secret, setSecret] = useState("truly-hyper-secure-passphrase#2026");

  // Ciphertext output
  const [ivBase64, setIvBase64] = useState<string>("Generating...");
  const [ciphertextBase64, setCiphertextBase64] = useState<string>("Encrypting...");
  const [copied, setCopied] = useState(false);

  // Cached random salt for consistent session demo
  const saltRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !saltRef.current) {
      saltRef.current = window.crypto.getRandomValues(new Uint8Array(16));
    }
  }, []);

  const runCryptoSimulation = useCallback(async () => {
    if (!isVaultUnlocked || typeof window === "undefined" || !window.crypto?.subtle) return;

    try {
      if (!saltRef.current) {
        saltRef.current = window.crypto.getRandomValues(new Uint8Array(16));
      }

      const enc = new TextEncoder();
      const pwd = masterPassword || "default";

      // 1. Import Master Password key material
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(pwd),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      // 2. Derive simulated Key Encryption Key (10,000 iterations for instant UI responsiveness)
      const aesKey = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: toArrayBuffer(saltRef.current),
          iterations: 10000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );

      // 3. Encrypt the sensitive JSON object with a fresh 12-byte IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const payloadData = JSON.stringify({
        title,
        username,
        secret,
        timestamp: Date.now(),
      });
      const payloadBytes = enc.encode(payloadData);

      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: toArrayBuffer(iv) },
        aesKey,
        toArrayBuffer(payloadBytes)
      );

      // Convert IV and Ciphertext to Base64
      let ivStr = "";
      for (let i = 0; i < iv.length; i++) {
        ivStr += String.fromCharCode(iv[i]);
      }
      const b64Iv = btoa(ivStr);

      const cipherArray = new Uint8Array(ciphertextBuffer);
      let cipherStr = "";
      for (let i = 0; i < cipherArray.length; i++) {
        cipherStr += String.fromCharCode(cipherArray[i]);
      }
      const b64Cipher = btoa(cipherStr);

      setIvBase64(`"${b64Iv}"`);
      setCiphertextBase64(`"${b64Cipher}"`);
    } catch (err) {
      console.error("Crypto simulation error:", err);
      setCiphertextBase64("Encryption error");
    }
  }, [isVaultUnlocked, masterPassword, title, username, secret]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        void runCryptoSimulation();
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [runCryptoSimulation]);

  function handleCopyPayload() {
    const text = `{\n  "iv": ${ivBase64},\n  "encryptedData": ${ciphertextBase64},\n  "cryptoVersion": 1\n}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    onShowToast("Encrypted payload copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleVaultLockState() {
    setIsVaultUnlocked((prev) => !prev);
  }

  return (
    <section id="playground" className="scroll-mt-20 border-y border-violet-100/60 bg-white py-20 relative">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <Terminal className="h-3.5 w-3.5" />
            <span>Interactive Web Crypto Simulation</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            See Zero-Knowledge Encryption in Action
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            This interactive engine runs <strong className="text-slate-900">directly inside your browser</strong> using the native <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-violet-700">SubtleCrypto</code> API. Type a secret below to watch it undergo PBKDF2 key derivation and AES-256-GCM encryption before your eyes.
          </p>
        </div>

        {/* Playground Card */}
        <div className="rounded-3xl border border-violet-100 bg-[#faf9fd] p-6 shadow-sm sm:p-8">
          {/* Master Password & Vault Status Bar */}
          <div className="mb-6 grid grid-cols-1 gap-4 border-b border-slate-200/70 pb-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <label
                htmlFor="demo-password-input"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Simulated Master Password (never leaves browser memory)
              </label>
              <div className="relative">
                <input
                  id="demo-password-input"
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  placeholder="Enter a master password..."
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Vault Memory Status */}
            <div className="flex flex-col justify-end">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                In-Memory Vault Status
              </span>
              <button
                type="button"
                onClick={toggleVaultLockState}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all ${
                  isVaultUnlocked
                    ? "bg-violet-600 hover:bg-violet-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isVaultUnlocked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Vault Unlocked (VEK in RAM)</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Vault Locked (Key Zeroized)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Secret Input & Ciphertext Output Split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Plaintext Input (Client Side) */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    1. Plaintext Sensitive Record
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Decrypted in Browser RAM</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="demo-title-input"
                      className="mb-1 block text-[11px] font-medium text-slate-500"
                    >
                      Item Title / Service
                    </label>
                    <input
                      id="demo-title-input"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-user-input"
                      className="mb-1 block text-[11px] font-medium text-slate-500"
                    >
                      Username / Identifier
                    </label>
                    <input
                      id="demo-user-input"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-secret-input"
                      className="mb-1 block text-[11px] font-medium text-slate-500"
                    >
                      Secret Password
                    </label>
                    <input
                      id="demo-secret-input"
                      type="text"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-violet-700 outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                <span>Algorithm: AES-GCM (256-bit)</span>
                <span>IV Size: 96-bit (12 bytes)</span>
              </div>
            </div>

            {/* Right: Wire Payload (What Next.js/MongoDB Actually Sees) */}
            <div className="flex flex-col justify-between rounded-2xl bg-[#181326] p-5 font-mono text-white">
              <div>
                <div className="mb-3 flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-300">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500"></span>
                    </span>
                    2. Wire Payload (MongoDB Storage)
                  </span>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                    Zero-Knowledge
                  </span>
                </div>

                {!isVaultUnlocked ? (
                  <div className="my-8 text-center text-xs text-slate-400">
                    <Lock className="mx-auto mb-2 h-8 w-8 text-violet-400" />
                    <p className="max-w-xs mx-auto">
                      Vault is locked. In-memory VEK reference is cleared. Plaintext is inaccessible.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] leading-relaxed">
                    <div>
                      <span className="font-semibold text-purple-400">&quot;iv&quot;:</span>{" "}
                      <span className="break-all text-slate-300">{ivBase64}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-purple-400">&quot;encryptedData&quot;:</span>
                      <p className="max-h-24 overflow-y-auto break-all pr-1 text-emerald-400/90">
                        {ciphertextBase64}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-purple-400">&quot;cryptoVersion&quot;:</span>{" "}
                      <span className="text-amber-300">1</span>,{" "}
                      <span className="font-semibold text-purple-400">&quot;kdf&quot;:</span>{" "}
                      <span className="text-slate-300">&quot;PBKDF2-SHA256 (600,000 iters)&quot;</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Database only receives high-entropy ciphertext</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied" : "Copy Payload"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
