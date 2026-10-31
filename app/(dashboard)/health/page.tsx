import { DashboardShell } from "@/components/dashboard-shell";
import { PasswordHealth } from "@/components/health/password-health";

export default function HealthPage() {
  return <DashboardShell eyebrow="Password Health" title="A clearer view of your security." description="Review password strength and reuse locally, without sending vault contents away." emptyState={{ title: "Health checks need a vault", description: "Add and unlock vault items to see local password health insights." }}><PasswordHealth /></DashboardShell>;
}