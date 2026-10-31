import { DashboardShell } from "@/components/dashboard-shell";

export default function ActivityPage() {
  return <DashboardShell eyebrow="Activity" title="A quiet record of your vault." description="Security-relevant events will be listed here without revealing the contents of your items." emptyState={{ title: "No activity to show", description: "Vault activity will appear here as you begin using PassEnd." }} />;
}