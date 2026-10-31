"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import {
  Activity,
  Archive,
  ChevronDown,
  CircleHelp,
  FolderLock,
  Heart,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { useVault } from "@/context/vault-provider";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "My Vault", href: "/vault", icon: FolderLock },
  { label: "Favorites", href: "/favorites", icon: Heart },
];

const tools = [
  { label: "Generator", href: "/generator", icon: Sparkles },
  { label: "Password Health", href: "/health", icon: ShieldCheck },
];

const workspace = [
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Trash", href: "/trash", icon: Archive },
  { label: "Settings", href: "/settings", icon: Settings },
];

type EmptyState = {
  title: string;
  description: string;
};

type DashboardShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  emptyState: EmptyState;
};

function NavSection({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: typeof navigation;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="mb-7">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#aaa3b5]">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#eee9ff] text-[#5d40b5]"
                  : "text-[#706a7d] hover:bg-[#f5f1fb] hover:text-[#3f374d]"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span>{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7354d6]" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardShell({
  eyebrow,
  title,
  description,
  emptyState,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lockVault } = useVault();

  return (
    <div className="min-h-screen bg-[#f7f5fb]">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-[#e8e4ef] bg-white px-5 py-6 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7354d6] text-white shadow-[0_6px_14px_rgba(115,84,214,0.22)]">
              <KeyRound size={19} strokeWidth={2.2} />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.03em] text-[#30283d]">PassEnd</span>
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 text-[#8b8495] hover:bg-[#f5f1fb] lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-11 flex-1 overflow-y-auto">
          <NavSection label="Main" items={navigation} onNavigate={() => setMobileOpen(false)} />
          <NavSection label="Tools" items={tools} onNavigate={() => setMobileOpen(false)} />
          <NavSection label="Workspace" items={workspace} onNavigate={() => setMobileOpen(false)} />
        </nav>

        <div className="border-t border-[#eeeaf3] pt-5">
          <Show when="signed-in">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2">
              <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#453c50]">Personal space</p>
                <p className="mt-0.5 truncate text-[11px] text-[#9b94a5]">Signed-in account</p>
              </div>
              <ChevronDown size={15} className="text-[#aaa3b5]" />
            </div>
          </Show>
          <Show when="signed-out">
            <div className="space-y-2 px-3">
              <SignInButton mode="modal">
                <button type="button" className="flex h-10 w-full items-center justify-center rounded-xl border border-[#e1dced] text-xs font-semibold text-[#6245b8] transition-colors hover:bg-[#f7f3ff]">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="flex h-10 w-full items-center justify-center rounded-xl bg-[#7354d6] text-xs font-semibold text-white transition-colors hover:bg-[#6042bd]">
                  Create account
                </button>
              </SignUpButton>
            </div>
          </Show>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-20 bg-[#2b2138]/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-[#e8e4ef] bg-[#f7f5fb]/95 px-5 backdrop-blur-md sm:px-8 lg:px-11">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-lg p-2 text-[#6e6679] hover:bg-white lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="hidden items-center gap-2 text-xs text-[#9a93a5] sm:flex">
              <span>Workspace</span>
              <span className="text-[#c2bccb]">/</span>
              <span className="font-medium text-[#5d5568]">{eyebrow}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden h-10 w-[210px] items-center gap-2 rounded-xl border border-[#e8e4ef] bg-white px-3 text-[#aaa3b5] sm:flex">
              <Search size={16} />
              <span className="text-xs">Search your vault</span>
              <span className="ml-auto rounded-md border border-[#eeeaf3] px-1.5 py-0.5 text-[10px] text-[#b3adbb]">⌘ K</span>
            </div>
            <button type="button" aria-label="Toggle theme" className="rounded-xl p-2.5 text-[#837b8e] hover:bg-white">
              <Moon size={18} strokeWidth={1.8} />
            </button>
            <button type="button" aria-label="Help and support" className="rounded-xl p-2.5 text-[#837b8e] hover:bg-white">
              <CircleHelp size={18} strokeWidth={1.8} />
            </button>
            <button type="button" aria-label="Lock vault" title="Lock vault" onClick={lockVault} className="rounded-xl p-2.5 text-[#837b8e] hover:bg-white">
              <LockKeyhole size={18} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-76px)] max-w-[1320px] px-5 py-9 sm:px-8 sm:py-12 lg:px-11">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.17em] text-[#8066ce]">{eyebrow}</p>
            <h1 className="text-[clamp(2rem,4vw,3.15rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#2e2639]">{title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#837b8e] sm:text-[15px]">{description}</p>
          </div>

          <section className="flex min-h-[390px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d9d1e8] bg-white/55 px-6 py-14 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eee9ff] text-[#7354d6]">
              <KeyRound size={28} strokeWidth={1.7} />
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#3c3348]">{emptyState.title}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#8a8295]">{emptyState.description}</p>
          </section>
        </main>
      </div>
    </div>
  );
}