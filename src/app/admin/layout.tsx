import { requireAdmin } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  return (
    <PanelShell variant="admin" userName={profile.nome || profile.email}>
      {children}
    </PanelShell>
  );
}
