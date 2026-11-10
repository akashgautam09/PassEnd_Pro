"use client";

import { useEffect } from "react";
import { Info, Shield, FileText, X } from "lucide-react";

export type ModalType = "about" | "privacy" | "terms" | null;

interface LegalModalsProps {
  activeModal: ModalType;
  onClose: () => void;
}

export function LegalModals({ activeModal, onClose }: LegalModalsProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (activeModal) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeModal, onClose]);

  if (!activeModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal 1: About PassEnd Pro */}
      {activeModal === "about" && (
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">About PassEnd Pro</h3>
                <p className="text-xs text-slate-500">A Truly Private Password Manager</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-600">
            <p>
              <strong className="text-slate-900">PassEnd Pro</strong> was created with one simple mission: your passwords should belong only to you, not software companies or servers.
            </p>
            <h4 className="pt-2 text-sm font-bold text-slate-900">How We Keep Things Simple &amp; Safe:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
              <li>
                <strong className="text-slate-800">Trusted Browser Security:</strong> We use the built-in, bank-level security already trusted by modern web browsers worldwide.
              </li>
              <li>
                <strong className="text-slate-800">We Cannot Read Your Data:</strong> Your Master Password never leaves your device. Our servers only store scrambled code that can never be unlocked without your password.
              </li>
              <li>
                <strong className="text-slate-800">You Are in Full Control:</strong> Download a safe backup of your vault anytime and restore your passwords whenever you get a new device.
              </li>
              <li>
                <strong className="text-slate-800">Separation for Safety:</strong> Your account sign-in and your secret passwords are kept strictly separate so your vault remains completely private.
              </li>
            </ul>
          </div>

          <div className="mt-8 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* Modal 2: Privacy Policy */}
      {activeModal === "privacy" && (
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Privacy Policy</h3>
                <p className="text-xs text-slate-500">Our 100% Privacy Promise</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-600">
            <p>
              At <strong className="text-slate-900">PassEnd Pro</strong>, privacy is built right into the code. Because your vault is locked directly on your computer or phone before anything is saved online, we cannot see, inspect, sell, or surrender your passwords to anyone.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">1. What We Never See</h4>
            <p className="text-xs leading-relaxed">
              We never have access to your Master Password, your Emergency Recovery Key, your actual usernames, passwords, website addresses, or secret notes.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">2. What We Store to Keep Your Account Running</h4>
            <p className="text-xs">
              To keep your account working and in sync across your devices, we only store:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
              <li>Your account email and login session.</li>
              <li>Scrambled, unreadable data that can only be unlocked with your Master Password.</li>
              <li>Basic organizational settings (such as whether an item is favorited or in the trash).</li>
            </ul>

            <h4 className="pt-2 text-sm font-bold text-slate-900">3. Safe Data Leak Checks</h4>
            <p className="text-xs leading-relaxed">
              When checking if your passwords were part of any internet breaches, we check safely using anonymous partial codes. Your actual passwords are never sent or shared across the internet.
            </p>
          </div>

          <div className="mt-8 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm shadow-violet-500/25"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Modal 3: Terms of Service */}
      {activeModal === "terms" && (
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Terms of Service</h3>
                <p className="text-xs text-slate-500">Simple, Clear Rules for Using PassEnd Pro</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-600">
            <h4 className="pt-1 text-sm font-bold text-slate-900">1. Keep Your Master Password &amp; Recovery Key Safe</h4>
            <p className="text-xs leading-relaxed">
              Because PassEnd Pro is truly private, <strong className="text-slate-900">nobody on our team can reset your Master Password if you lose it</strong>. Your Emergency Recovery Key is the only way to recover your vault, so please download or print it and store it in a safe place.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">2. Respectful Use</h4>
            <p className="text-xs leading-relaxed">
              You agree to use PassEnd Pro respectfully, for lawful purposes, and not attempt to disrupt or abuse the service for other users.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">3. Device Security</h4>
            <p className="text-xs leading-relaxed">
              PassEnd Pro uses top-tier encryption to guard your passwords, but always remember to keep your own phone and computer free from viruses and unauthorized physical access.
            </p>
          </div>

          <div className="mt-8 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Agree &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
