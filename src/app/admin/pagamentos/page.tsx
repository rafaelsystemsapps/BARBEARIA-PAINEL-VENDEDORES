import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PagamentosClient, type PaymentRow } from "./pagamentos-client";

export const metadata = { title: "Confirmar pagamentos" };

export default async function PagamentosPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [pendingRes, recentRes, diasRes] = await Promise.all([
    supabase
      .from("payments")
      .select("*, clients(barbearia, profiles(nome))")
      .eq("status", "aguardando")
      .order("vencimento", { ascending: true }),
    supabase
      .from("payments")
      .select("*, clients(barbearia, profiles(nome))")
      .eq("status", "confirmado")
      .order("confirmed_at", { ascending: false })
      .limit(10),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "dias_alerta_inadimplencia")
      .single(),
  ]);

  const diasAlerta = parseInt(diasRes.data?.value ?? "7", 10) || 7;

  return (
    <PagamentosClient
      pending={(pendingRes.data ?? []) as unknown as PaymentRow[]}
      recent={(recentRes.data ?? []) as unknown as PaymentRow[]}
      diasAlerta={diasAlerta}
    />
  );
}
