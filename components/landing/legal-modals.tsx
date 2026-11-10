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
                <p className="text-xs text-slate-500">Independent Zero-Knowledge Password Vault</p>
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
              <strong className="text-slate-900">PassEnd Pro</strong> was designed with a fundamental premise: you should never have to take a software vendor&apos;s word when it comes to your most critical passwords.
            </p>
            <h4 className="pt-2 text-sm font-bold text-slate-900">Our Engineering Philosophy:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
              <li>
                <strong className="text-slate-800">No Unverified Cryptography:</strong> We utilize native, audited Web Crypto APIs (SubtleCrypto) already trusted by billions of browsers daily.
              </li>
              <li>
                <strong className="text-slate-800">Zero Server-Side Decryption:</strong> Your Master Password is mathematically decoupled from your server sessions. The server holds ciphertext envelopes and zero cryptographic access.
              </li>
              <li>
                <strong className="text-slate-800">No Data Lock-In:</strong> Full portability with encrypted <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-violet-700">.passend</code> archives and client-side importers for Bitwarden and 1Password.
              </li>
              <li>
                <strong className="text-slate-800">Separation of Identity & Vault:</strong> User accounts are handled by Clerk, while cryptographic vault unsealing is managed purely in temporary browser memory.
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

      {/* Modal 2: Zero-Knowledge Privacy Policy */}
      {activeModal === "privacy" && (
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Zero-Knowledge Privacy Policy</h3>
                <p className="text-xs text-slate-500">Effective Date: November 2026</p>
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
              At <strong className="text-slate-900">PassEnd Pro</strong>, privacy is enforced cryptographically, not through legal jargon. Because your vault is encrypted in your browser prior to network transit, we cannot sell, monetize, inspect, or surrender your passwords under any subpoena.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">1. What Information We Never See</h4>
            <p className="text-xs leading-relaxed">
              We never have access to your Master Password, your 256-bit Emergency Recovery Key, your decrypted login items, secure notes, TOTP seeds, or website URLs.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">2. What Information We Store</h4>
            <p className="text-xs">
              To provide synchronization and operational integrity, MongoDB stores:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
              <li>Your Clerk Account ID and email for authentication.</li>
              <li>KDF parameters (Salt, PBKDF2 iteration count).</li>
              <li>Encrypted ciphertext blobs, 12-byte initialization vectors, and authentication tags.</li>
              <li>Operational flags: whether an item is soft-deleted (Trash) or favorited.</li>
            </ul>

            <h4 className="pt-2 text-sm font-bold text-slate-900">3. Third-Party Services</h4>
            <p className="text-xs leading-relaxed">
              When performing compromised password audits, PassEnd Pro uses Have I Been Pwned&apos;s k-Anonymity API. Only the first 5 characters of your password&apos;s SHA-1 hash are sent. The full hash and password never leave your device.
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
                <p className="text-xs text-slate-500">PassEnd Pro End-User Agreement</p>
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
            <h4 className="pt-1 text-sm font-bold text-slate-900">1. User Responsibility & Key Custody</h4>
            <p className="text-xs leading-relaxed">
              PassEnd Pro operates strictly on a zero-knowledge architecture. If you lose both your Master Password and your Emergency Recovery Kit, <strong className="text-slate-900">your vault cannot be decrypted by PassEnd Pro staff, automated systems, or support agents</strong>. You agree that backup custody of your keys is your sole responsibility.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">2. Acceptable Use</h4>
            <p className="text-xs leading-relaxed">
              You agree not to use PassEnd Pro to store materials in violation of relevant export regulations or laws, or to abuse the serverless API endpoints through automated scraping or deliberate denial-of-service attempts.
            </p>

            <h4 className="pt-2 text-sm font-bold text-slate-900">3. Disclaimers</h4>
            <p className="text-xs leading-relaxed">
              PassEnd Pro provides encrypted credential storage as-is. While we employ NIST and OWASP-recommended cryptographic algorithms (AES-256-GCM, PBKDF2-HMAC-SHA256), no software guarantees absolute protection against physical endpoint compromise, active keyloggers, or hardware-level tampering on your personal device.
            </p>
          </div>

          <div className="mt-8 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Agree & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
