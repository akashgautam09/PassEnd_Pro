import { DashboardShell } from "@/components/dashboard-shell";

export default function FavoritesPage() {
  return <DashboardShell eyebrow="Favorites" title="Your most-used logins, close at hand." description="Favorite items will appear here for quick access." emptyState={{ title: "No favorites yet", description: "When a login matters most, mark it as a favorite and it will appear here." }} />;
}