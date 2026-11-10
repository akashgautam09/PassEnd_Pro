"use client";

import { useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  FileCode2,
  Cpu,
  Fingerprint,
  Database,
  Shield,
  Sparkles,
  ArrowRight,
  LifeBuoy,
  Timer,
  Layers,
  Download,
  Cloud,
  Lock,
  Check,
} from "lucide-react";

import { LandingNavbar } from "@/components/landing/landing-navbar";
import { CryptoPlayground } from "@/components/landing/crypto-playground";
import { LegalModals, type ModalType } from "@/components/landing/legal-modals";

export default function LandingPage() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2800);
  }

  function scrollToPlayground() {
    const el = document.getElementById("playground");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#faf9fd] text-[#1c1926] antialiased selection:bg-violet-100 selection:text-violet-900 font-sans">
      {/* Ambient Decorative Background Glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[25%] h-[650px] w-[650px] rounded-full bg-gradient-to-br from-violet-200/40 to-purple-100/10 blur-[130px]" />
        <div className="absolute -right-[15%] top-[35%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-purple-200/30 to-violet-100/10 blur-[140px]" />
        <div className="grid-pattern absolute inset-0 opacity-60" />
      </div>

      {/* 1. Navigation Bar (Exact second code snippet) */}
      <LandingNavbar onOpenModal={(modalId) => setActiveModal(modalId)} />

      {/* Main Content Area */}
      <main className="flex-grow">
        {/* ========================================================================= */}
        {/* 2. HERO SECTION                                                           */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-28 md:pb-32">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            {/* Pill Label */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-100/80 px-3.5 py-1.5 text-[12px] font-semibold tracking-wide uppercase text-violet-800 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600"></span>
              </span>
              <span>Next-Gen Zero-Knowledge Vault</span>
            </div>

            {/* Headline */}
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-[#171324] leading-[1.12] sm:text-6xl lg:text-7xl">
              Your digital life, <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-violet-600 via-purple-700 to-indigo-800 bg-clip-text text-transparent">
                kept close.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mb-10 max-w-2xl text-lg font-normal leading-relaxed text-slate-600 sm:text-xl">
              A calm, private place for the credentials that matter. Built with client-side Web Crypto key wrapping, zero cloud plaintext, and absolute data sovereignty.
            </p>

            {/* CTA Buttons */}
            <div className="mb-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={scrollToPlayground}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:from-violet-700 hover:to-purple-800 active:scale-95 sm:w-auto"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Try Live Vault Playground</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal("about")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-6 py-3.5 text-[15px] font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
              >
                <FileCode2 className="h-4 w-4 text-violet-600" />
                <span>Architecture Specs</span>
              </button>
            </div>

            {/* Trust Badges Row */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-600" />
                <span>Client-Side AES-256-GCM</span>
              </div>
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-violet-600" />
                <span>256-bit Emergency Kit</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-violet-600" />
                <span>No Master Password on Server</span>
              </div>
            </div>
          </div>

          {/* Hero Dashboard Visual Preview */}
          <div className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
            <div className="rounded-3xl border border-white bg-gradient-to-b from-violet-200/60 via-purple-100/40 to-transparent p-2 shadow-xl shadow-purple-900/5 sm:p-3">
              <div className="overflow-hidden rounded-2xl border border-[#ede9f5] bg-white shadow-xs">
                {/* Window header bar */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                    <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                    <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                    <span className="ml-2 font-mono text-xs text-slate-400">workspace / passend-vault</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 font-mono text-xs text-slate-500">
                    <Shield className="h-3.5 w-3.5 text-violet-600" />
                    <span>zero_knowledge_active</span>
                  </div>
                </div>

                {/* Simulated App Frame */}
                <div className="relative flex min-h-[340px] flex-col items-center justify-center bg-gradient-to-b from-[#fbfaff] to-white p-8 text-center sm:p-14">
                  <div className="flex w-full max-w-xl flex-col items-center rounded-3xl border border-dashed border-violet-200/90 bg-white/70 p-8 backdrop-blur-xs shadow-xs sm:p-10">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600 shadow-xs">
                      <KeyRound className="h-8 w-8 -rotate-45" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold tracking-tight text-[#1d182b] sm:text-2xl">
                      Your vault is ready when you are
                    </h3>
                    <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-500">
                      Set up your vault to start keeping your important logins, secure notes, and 2FA tokens in one private place.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={scrollToPlayground}
                        className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-violet-700"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Unlock Interactive Demo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. LIVE CLIENT-SIDE CRYPTOGRAPHIC PLAYGROUND                               */}
        {/* ========================================================================= */}
        <CryptoPlayground onShowToast={showToast} />

        {/* ========================================================================= */}
        {/* 4. CORE FEATURES ARCHITECTURE GRID                                        */}
        {/* ========================================================================= */}
        <section id="features" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-600">
              Engineered for Confidence
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#171324] sm:text-5xl">
              Everything you need in a modern vault. Nothing you don&apos;t.
            </h2>
            <p className="mt-4 text-base text-slate-600 sm:text-lg">
              Designed strictly around zero-knowledge foundations. We intentionally avoided unverified complexity, ensuring complete ownership over your credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Key Wrapping */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">VEK/KEK Key-Wrapping</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Instead of deriving an item key directly, we generate a random 256-bit Vault Encryption Key wrapped by your Master Password. Changing your password only re-wraps the VEK—no full vault re-encryption required.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>OWASP-Compliant PBKDF2</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 2: 256-bit Recovery Kit */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <LifeBuoy className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Emergency Recovery Kit</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Generate a true 256-bit random emergency recovery key formatted into 64 hexadecimal characters. It separately wraps your VEK, protecting you from total data loss without compromising zero-knowledge guarantees.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Downloadable & Printable</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 3: Local Health & HIBP */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">k-Anonymity Breach Checks</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Check for compromised credentials using Have I Been Pwned. We hash the password locally with SHA-1, send only the 5-character prefix, and inspect returned suffixes in browser RAM. Your secret is never sent.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Private HIBP Range API</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 4: TOTP Authenticator */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Timer className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Integrated 2FA / TOTP</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Store 2FA seeds inside your encrypted vault payloads. The browser generates standard RFC 6238 time-based tokens with an animated countdown ring, keeping your login flow streamlined.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Web Crypto HMAC-SHA1</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 5: Multi-Tab Coordination */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Cross-Tab State Sync</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Using the browser&apos;s BroadcastChannel, locking your vault or updating an item in one tab instantly propagates the signal to all other tabs—without ever sending keys over the wire.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Zero-Leak Event Bus</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 6: Encrypted Portable Backups */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Encrypted .passend Backups</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Export and restore durable encrypted JSON archives. During restoration, records are safely decrypted locally and re-encrypted with the target vault&apos;s VEK before sync, preventing cross-user collisions.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Durable Data Portability</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. SECURITY ARCHITECTURE COMPARISON SECTION                               */}
        {/* ========================================================================= */}
        <section id="security" className="scroll-mt-20 relative overflow-hidden bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <span className="rounded-full border border-purple-800/40 bg-purple-950/80 px-3 py-1 font-mono text-xs uppercase tracking-widest text-purple-400">
                Zero-Knowledge Specification
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
                How PassEnd Pro Guarantees Privacy
              </h2>
              <p className="mt-3 text-sm text-slate-400 sm:text-base">
                We separate your user identity (Clerk) from your encryption key (Master Password &amp; VEK). Here is exactly what is visible to the cloud versus what stays locked on your device.
              </p>
            </div>

            {/* Comparative Visual Table */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Cloud / Server Boundary */}
              <div className="rounded-3xl border border-slate-700/60 bg-slate-800/60 p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Visible to Server &amp; Database</h3>
                    <p className="text-xs text-slate-400">Operational metadata required to run the service</p>
                  </div>
                </div>

                <ul className="space-y-3.5 text-xs text-slate-300 sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Your Clerk account ID and authenticated session token</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Cryptographic parameters: KDF salt &amp; iteration count</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Wrapped VEK ciphertext &amp; 12-byte initialization vectors</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      Operational item flags: <code className="rounded bg-slate-700/60 px-1 py-0.5 font-mono text-[11px] text-amber-300">isFavorite</code>, <code className="rounded bg-slate-700/60 px-1 py-0.5 font-mono text-[11px] text-amber-300">isTrash</code>, <code className="rounded bg-slate-700/60 px-1 py-0.5 font-mono text-[11px] text-amber-300">updatedAt</code>
                    </span>
                  </li>
                </ul>
              </div>

              {/* Client-Side Only Boundary */}
              <div className="relative rounded-3xl border border-violet-500/30 bg-gradient-to-br from-[#1a1233] to-[#25184a] p-6 sm:p-8">
                <div className="absolute -top-3 right-6 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                  100% Client-Side
                </div>

                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/40 bg-violet-500/20 text-violet-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Never Leaves Browser RAM</h3>
                    <p className="text-xs text-violet-200/70">Cryptographically isolated and zeroized</p>
                  </div>
                </div>

                <ul className="space-y-3.5 text-xs text-violet-100 sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Master Password:</strong> Never sent to Next.js or MongoDB
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Decrypted Credentials:</strong> Plaintext usernames, passwords, notes
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Recovery Key:</strong> High-entropy 32-byte secret kept offline
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">TOTP 2FA Seeds:</strong> Decoded and truncated inside browser only
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. CALL TO ACTION                                                         */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-b from-white to-[#faf9fd] py-24 text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#171324] sm:text-5xl">
              Take control of your credentials today.
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-base text-slate-600 sm:text-lg">
              No subscriptions, no corporate lock-in, and no unverified crypto claims. Just calm, private security.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/vault"
                className="w-full sm:w-auto rounded-2xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-700"
              >
                Open Interactive Vault
              </Link>
              <button
                type="button"
                onClick={() => setActiveModal("privacy")}
                className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                Read Zero-Knowledge Policy
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 7. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="border-t border-[#ede9f5] bg-white py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
              <KeyRound className="h-4 w-4 -rotate-45" />
            </div>
            <span className="text-base font-bold text-slate-900">PassEnd Pro</span>
            <span className="text-xs text-slate-400">© 2026. All rights reserved.</span>
          </div>

          {/* Legal & Page Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setActiveModal("about")}
              className="hover:text-violet-700 transition-colors"
            >
              About PassEnd
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("privacy")}
              className="hover:text-violet-700 transition-colors"
            >
              Zero-Knowledge Privacy
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("terms")}
              className="hover:text-violet-700 transition-colors"
            >
              Terms of Service
            </button>
            <a href="#security" className="hover:text-violet-700 transition-colors">
              Security Architecture
            </a>
          </div>
        </div>
      </footer>

      {/* Modals Container */}
      <LegalModals activeModal={activeModal} onClose={() => setActiveModal(null)} />

      {/* Toast Notification Box */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl transition-all duration-300">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
