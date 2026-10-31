import { DashboardShell } from "@/components/dashboard-shell";

export default function GeneratorPage() {
  return <DashboardShell eyebrow="Generator" title="Create a stronger way in." description="Generate unique passwords locally in your browser when you need one." emptyState={{ title: "Your generator is ready", description: "Password generation will be available here once the vault experience is connected." }} />;
}