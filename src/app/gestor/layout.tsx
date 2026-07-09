import { requireGestor } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";

export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireGestor();

  return (
    <PanelShell variant="gestor" userName={profile.nome || profile.email}>
      {children}
    </PanelShell>
  );
}
