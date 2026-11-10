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
    <div className="relative flex min-h-screen flex-col bg-[#faf9fd] text-[#1c1926] antialiased selection:bg-violet-100 selection:text-violet-900 font-sans">
      {/* Ambient Decorative Background Glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] -top-[25%] h-[650px] w-[650px] rounded-full bg-gradient-to-br from-violet-200/40 to-purple-100/10 blur-[130px]" />
        <div className="absolute -right-[15%] top-[35%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-purple-200/30 to-violet-100/10 blur-[140px]" />
        <div className="grid-pattern absolute inset-0 opacity-60" />
      </div>

      {/* 1. Navigation Bar */}
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
              <span>Truly Private Password Vault</span>
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
              A calm, private place for the passwords that matter. Your information is locked right on your computer or phone before it ever touches the internet, so only you can see it.
            </p>

            {/* CTA Buttons */}
            <div className="mb-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={scrollToPlayground}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:from-violet-700 hover:to-purple-800 active:scale-95 sm:w-auto"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Try the Live Privacy Demo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal("about")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-6 py-3.5 text-[15px] font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
              >
                <FileCode2 className="h-4 w-4 text-violet-600" />
                <span>How It Works</span>
              </button>
            </div>

            {/* Trust Badges Row */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-600" />
                <span>Bank-Grade Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-violet-600" />
                <span>Emergency Recovery Key</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-violet-600" />
                <span>We Never See Your Password</span>
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
                    <span className="ml-2 font-mono text-xs text-slate-400">PassEnd Pro / My Safe Vault</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 font-mono text-xs text-slate-500">
                    <Shield className="h-3.5 w-3.5 text-violet-600" />
                    <span>100% private &amp; secure</span>
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
                      Set up your vault to keep your important logins, private notes, and two-factor codes safe in one place.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={scrollToPlayground}
                        className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-violet-700"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Try Interactive Demo</span>
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
              Built for Peace of Mind
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#171324] sm:text-5xl">
              Everything you need in a modern vault. Nothing you don&apos;t.
            </h2>
            <p className="mt-4 text-base text-slate-600 sm:text-lg">
              Designed so your data stays 100% yours. We keep things simple, transparent, and completely private so you never have to worry about your passwords.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Instant Password Changes */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Instant Password Updates</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Change your Master Password whenever you want without the hassle of re-locking or re-encrypting every single item. Your vault stays safe and updates in an instant.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Safe &amp; Fast Updates</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 2: Emergency Recovery Key */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <LifeBuoy className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Emergency Recovery Key</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Get a unique safety key you can download or print. If you ever forget your Master Password, this key ensures you never get locked out of your vault.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Downloadable &amp; Printable</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 3: Data Leak Warnings */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Data Leak Warnings</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Automatically check if any of your saved passwords have appeared in known internet data leaks. We check safely without ever sharing or sending your real password.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Private Leak Check</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 4: Two-Factor Codes */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Timer className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Built-in Two-Factor Codes</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Generate 6-digit verification codes for your accounts right inside your vault. There&apos;s no need to switch back and forth with a separate authenticator app.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Built-in Authenticator</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 5: Multi-Tab Sync */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Automatic Multi-Tab Sync</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  When you lock your vault or update a password in one browser tab, all your other open tabs update and lock instantly for your peace of mind.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Instant Browser Sync</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </div>
            </div>

            {/* Feature 6: Simple Encrypted Backups */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-xs transition-all hover:border-violet-200 hover:shadow-md">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Simple Encrypted Backups</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Download a safe, backup copy of your passwords anytime. You can easily restore all your logins whenever you get a new computer or switch devices.
                </p>
              </div>
              <div className="mt-6 flex items-center border-t border-slate-50 pt-4 text-xs font-semibold text-violet-700">
                <span>Export &amp; Restore Anytime</span>
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
                Clear Privacy Promise
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
                How We Keep Your Information Secret
              </h2>
              <p className="mt-3 text-sm text-slate-400 sm:text-base leading-relaxed">
                Your account sign-in and your secret passwords are kept strictly separate. Here is a simple look at what our server can see versus what only you can see.
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
                    <h3 className="text-lg font-bold text-white">What our servers store to keep your account working</h3>
                    <p className="text-xs text-slate-400">Basic operational information needed to run the service</p>
                  </div>
                </div>

                <ul className="space-y-3.5 text-xs text-slate-300 sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Your account email and login session</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Settings needed to configure your lock</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Scrambled, unreadable data that can only be unlocked with your Master Password</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>Helpful tags: whether an item is favorited or in the trash</span>
                  </li>
                </ul>
              </div>

              {/* Client-Side Only Boundary */}
              <div className="relative rounded-3xl border border-violet-500/30 bg-gradient-to-br from-[#1a1233] to-[#25184a] p-6 sm:p-8">
                <div className="absolute -top-3 right-6 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                  100% Private to You
                </div>

                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/40 bg-violet-500/20 text-violet-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">What only YOU can see</h3>
                    <p className="text-xs text-violet-200/70">Kept in your browser while unlocked, never saved to our servers</p>
                  </div>
                </div>

                <ul className="space-y-3.5 text-xs text-violet-100 sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Master Password:</strong> Never sent to our servers or stored in our database
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Real Passwords &amp; Usernames:</strong> Only visible to you on your screen
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Emergency Recovery Key:</strong> Kept offline in your hands only
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Two-Factor Codes:</strong> Calculated right on your device
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
              Take control of your passwords today.
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-base text-slate-600 sm:text-lg">
              No hidden fees, no subscriptions, and no complicated setups. Just calm, private security you can trust.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/vault"
                className="w-full sm:w-auto rounded-2xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-700"
              >
                Open My Vault
              </Link>
              <button
                type="button"
                onClick={() => setActiveModal("privacy")}
                className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                Read Privacy Policy
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
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("terms")}
              className="hover:text-violet-700 transition-colors"
            >
              Terms of Service
            </button>
            <a href="#security" className="hover:text-violet-700 transition-colors">
              How It Works
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
