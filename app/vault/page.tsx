import { DashboardShell } from "@/components/dashboard-shell";

export default function VaultPage() {
  return <DashboardShell eyebrow="My Vault" title="Everything important, in one place." description="Your saved logins will live here, encrypted and ready when you need them." emptyState={{ title: "Your vault is empty", description: "Add your first login to begin building your private collection." }} />;
}