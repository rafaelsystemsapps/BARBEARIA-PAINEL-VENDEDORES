import { requireSeller } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";

export default async function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSeller();

  return (
    <PanelShell variant="seller" userName={profile.nome || profile.email}>
      {children}
    </PanelShell>
  );
}
