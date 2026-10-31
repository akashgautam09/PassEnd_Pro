import { DashboardShell } from "@/components/dashboard-shell";

export default function SettingsPage() {
  return <DashboardShell eyebrow="Settings" title="Your vault, your rules." description="Manage how PassEnd protects and behaves once your vault is set up." emptyState={{ title: "Settings are waiting", description: "Vault lock and security preferences will be available after setup." }} />;
}