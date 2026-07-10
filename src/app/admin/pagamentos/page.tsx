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
      .select(
        "*, clients(barbearia, profiles!clients_seller_id_fkey(nome))"
      )
      .eq("status", "aguardando")
      .order("vencimento", { ascending: true }),
    supabase
      .from("payments")
      .select(
        "*, clients(barbearia, profiles!clients_seller_id_fkey(nome))"
      )
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

  // Não engolir erros silenciosamente: se a query falhar (ex.: join
  // ambíguo), registrar para não virar "lista vazia" sem explicação.
  if (pendingRes.error) {
    console.error("Erro ao carregar cobranças pendentes:", pendingRes.error.message);
  }
  if (recentRes.error) {
    console.error("Erro ao carregar cobranças confirmadas:", recentRes.error.message);
  }

  return (
    <PagamentosClient
      pending={(pendingRes.data ?? []) as unknown as PaymentRow[]}
      recent={(recentRes.data ?? []) as unknown as PaymentRow[]}
      diasAlerta={diasAlerta}
    />
  );
}
