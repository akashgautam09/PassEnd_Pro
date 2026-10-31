import { VaultProvider } from "@/context/vault-provider";
import { VaultGate } from "@/components/vault/vault-gate";

export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <VaultGate>{children}</VaultGate>
    </VaultProvider>
  );
}