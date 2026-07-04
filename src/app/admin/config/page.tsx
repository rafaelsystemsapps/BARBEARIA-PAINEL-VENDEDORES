import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Setting } from "@/lib/types";
import { ConfigForm } from "./config-form";

export const metadata = { title: "Configurações" };

export default async function ConfigPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase.from("settings").select("*");
  const settings = new Map(((data ?? []) as Setting[]).map((s) => [s.key, s.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parâmetros do programa de parceiros.
        </p>
      </div>

      <ConfigForm
        demoUrl={settings.get("demo_url") ?? ""}
        saqueMinimoCents={parseInt(settings.get("saque_minimo_cents") ?? "5000", 10) || 5000}
        diasAlerta={parseInt(settings.get("dias_alerta_inadimplencia") ?? "7", 10) || 7}
        adminPixKey={settings.get("admin_pix_key") ?? ""}
      />
    </div>
  );
}
