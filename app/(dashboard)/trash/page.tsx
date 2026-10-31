import { DashboardShell } from "@/components/dashboard-shell";

export default function TrashPage() {
  return <DashboardShell eyebrow="Trash" title="A second chance before goodbye." description="Items you remove will stay here temporarily before permanent deletion." emptyState={{ title: "Trash is empty", description: "Deleted vault items will appear here during their retention period." }} />;
}