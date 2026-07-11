import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GestorLeadsClient, type TeamRow } from "./leads-client";

export const metadata = { title: "Leads do time" };

export default async function GestorLeadsPage() {
  const gestor = await requireGestor();
  const supabase = await createClient();

  const [clientsRes, paymentsRes, sellersRes, leadsRes] = await Promise.all([
    // RLS: gestor lê apenas os clientes do próprio time.
    supabase
      .from("clients")
      .select("*")
      .eq("gestor_id", gestor.id)
      .order("closed_at", { ascending: false }),
    supabase
      .from("payments")
      .select("client_id, tipo, vencimento, status")
      .eq("status", "aguardando"),
    supabase
      .from("profiles")
      .select("id, nome")
      .eq("gestor_id", gestor.id),
    // Leads em aberto dos vendedores do time (funil).
    supabase
      .from("leads")
      .select("id, seller_id, nome_contato, barbearia, cidade, status")
      .in("status", ["novo", "em_negociacao"]),
  ]);

  if (clientsRes.error) {
    console.error("Erro ao carregar clientes do time:", clientsRes.error.message);
  }

  const sellers = (sellersRes.data ?? []) as { id: string; nome: string }[];
  const sellerName = new Map(sellers.map((s) => [s.id, s.nome]));
  const sellerIds = new Set(sellers.map((s) => s.id));

  type Pending = { client_id: string; tipo: string; vencimento: string };
  const pending = (paymentsRes.data ?? []) as Pending[];
  const vencByClient = new Map<string, string>();
  for (const p of pending) {
    if (p.tipo !== "mensalidade") continue;
    const atual = vencByClient.get(p.client_id);
    if (!atual || p.vencimento < atual) vencByClient.set(p.client_id, p.vencimento);
  }

  const rows = ((clientsRes.data ?? []) as unknown as TeamRow[]).map((c) => ({
    ...c,
    vendedor: sellerName.get(c.seller_id) ?? "—",
    vencimento_aberto: vencByClient.get(c.id) ?? null,
  }));

  const leadsAbertos = ((leadsRes.data ?? []) as {
    id: string;
    seller_id: string;
    nome_contato: string;
    barbearia: string;
    cidade: string | null;
    status: string;
  }[])
    .filter((l) => sellerIds.has(l.seller_id))
    .map((l) => ({ ...l, vendedor: sellerName.get(l.seller_id) ?? "—" }));

  return <GestorLeadsClient clients={rows} leadsAbertos={leadsAbertos} />;
}
