import { DashboardShell } from "@/components/dashboard-shell";
import { PasswordGenerator } from "@/components/generator/password-generator";

export default function GeneratorPage() {
  return <DashboardShell eyebrow="Generator" title="Create a stronger way in." description="Generate unique passwords locally in your browser when you need one." emptyState={{ title: "Your generator is ready", description: "Password generation happens locally in your browser." }}><PasswordGenerator /></DashboardShell>;
}