import { DashboardShell } from "@/components/dashboard-shell";

export default function Home() {
  return (
    <DashboardShell
      eyebrow="Overview"
      title="Your digital life, kept close."
      description="A calm, private place for the credentials that matter."
      emptyState={{
        title: "Your vault is ready when you are",
        description: "Set up your vault to start keeping your important logins in one private place.",
      }}
    />
  );
}