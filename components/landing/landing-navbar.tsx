"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { ChevronDown, ArrowRight, Menu, X, KeyRound, LogOut } from "lucide-react";
import type { ModalType } from "./legal-modals";

interface LandingNavbarProps {
  onOpenModal: (id: ModalType) => void;
}

export function LandingNavbar({ onOpenModal }: LandingNavbarProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trustDropdownOpen, setTrustDropdownOpen] = useState(false);

  function toggleMobileMenu() {
    setMobileMenuOpen((prev) => !prev);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Identity */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-500/20 transition-transform group-hover:scale-105">
            <KeyRound className="h-4.5 w-4.5 -rotate-45" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold tracking-tight text-slate-900">PassEnd</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">Pro</span>
          </div>
        </Link>

        {/* Center: Desktop Primary Navigation */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
          <a
            href="#features"
            className="rounded-lg px-3.5 py-1.5 hover:bg-slate-100/70 hover:text-slate-900 transition-colors"
          >
            Features
          </a>
          <a
            href="#security"
            className="rounded-lg px-3.5 py-1.5 hover:bg-slate-100/70 hover:text-slate-900 transition-colors"
          >
            How It Works
          </a>
          <a
            href="#playground"
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 hover:bg-slate-100/70 hover:text-slate-900 transition-colors"
          >
            <span>Live Demo</span>
            <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Live
            </span>
          </a>

          {/* Compact "Trust & Privacy" Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setTrustDropdownOpen(true)}
            onMouseLeave={() => setTrustDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={() => setTrustDropdownOpen((prev) => !prev)}
              aria-expanded={trustDropdownOpen}
              className="flex items-center gap-1 rounded-lg px-3.5 py-1.5 hover:bg-slate-100/70 hover:text-slate-900 transition-colors"
            >
              <span>Trust &amp; Privacy</span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  trustDropdownOpen ? "rotate-180 text-slate-600" : ""
                }`}
              />
            </button>

            {/* Dropdown Popover */}
            {trustDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5 transition-all">
                <button
                  type="button"
                  onClick={() => {
                    setTrustDropdownOpen(false);
                    onOpenModal("about");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  <span>About PassEnd</span>
                  <span className="text-[10px] text-slate-400">Story</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrustDropdownOpen(false);
                    onOpenModal("privacy");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  <span>Privacy Policy</span>
                  <span className="text-[10px] font-semibold text-violet-600">100% Private</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrustDropdownOpen(false);
                    onOpenModal("terms");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  <span>Terms of Service</span>
                  <span className="text-[10px] text-slate-400">Simple Rules</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Right: Authentication & Launch (Desktop) + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {/* Desktop Auth Group */}
          <div className="hidden sm:flex items-center gap-2">
            {isLoaded && isSignedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => void signOut({ redirectUrl: "/" })}
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
                <Link
                  href="/vault"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700 active:scale-[0.98] transition-all"
                >
                  <span>Go to Vault</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : isLoaded && !isSignedIn ? (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/vault"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700 active:scale-[0.98] transition-all"
                >
                  <span>Open Vault</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <Link
                href="/vault"
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700 active:scale-[0.98] transition-all"
              >
                <span>Open Vault</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white/95 px-4 pt-3 pb-6 backdrop-blur-lg md:hidden transition-all">
          <div className="flex flex-col gap-1.5 pb-4 border-b border-slate-100">
            <span className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Product
            </span>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Features
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              How It Works
            </a>
            <a
              href="#playground"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Live Demo</span>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                Live
              </span>
            </a>
          </div>

          <div className="flex flex-col gap-1.5 py-4 border-b border-slate-100">
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Trust &amp; Privacy
            </span>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenModal("about");
              }}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              About PassEnd
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenModal("privacy");
              }}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>Privacy Policy</span>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                100% Private
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenModal("terms");
              }}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Terms of Service
            </button>
          </div>

          {/* Mobile Auth Buttons */}
          <div className="pt-4 flex flex-col gap-2">
            {isLoaded && isSignedIn ? (
              <>
                <Link
                  href="/vault"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700"
                >
                  Go to Vault
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void signOut({ redirectUrl: "/" });
                  }}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Sign In
                </Link>
                <Link
                  href="/vault"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-700"
                >
                  Open Vault
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      </header>
      <div className="h-16 shrink-0" aria-hidden="true" />
    </>
  );
}
