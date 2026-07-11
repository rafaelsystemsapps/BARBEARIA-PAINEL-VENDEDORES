import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CarteiraClient, type CarteiraRow } from "./carteira-client";

export const metadata = { title: "Minha carteira" };

export default async function CarteiraPage() {
  await requireSeller();
  const supabase = await createClient();

  const [clientsRes, paymentsRes, pixRes] = await Promise.all([
    // Traz o WhatsApp do lead junto (para o botão de contato).
    supabase
      .from("clients")
      .select("*, leads(whatsapp, nome_contato)")
      .order("closed_at", { ascending: false }),
    // Cobranças em aberto: definem "a vencer" e "vencido".
    supabase
      .from("payments")
      .select("client_id, tipo, vencimento, status, valor_esperado_cents")
      .eq("status", "aguardando"),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_pix_key")
      .maybeSingle(),
  ]);

  if (clientsRes.error) {
    console.error("Erro ao carregar carteira:", clientsRes.error.message);
  }

  const pixKey = (pixRes.data?.value ?? "").trim() || null;

  type PendingPayment = {
    client_id: string;
    tipo: string;
    vencimento: string;
    valor_esperado_cents: number;
  };
  const pending = (paymentsRes.data ?? []) as PendingPayment[];

  // Mensalidade em aberto mais próxima por cliente.
  const pendingByClient = new Map<string, PendingPayment>();
  for (const p of pending) {
    if (p.tipo !== "mensalidade") continue;
    const atual = pendingByClient.get(p.client_id);
    if (!atual || p.vencimento < atual.vencimento) {
      pendingByClient.set(p.client_id, p);
    }
  }

  const rows = ((clientsRes.data ?? []) as unknown as CarteiraRow[]).map((c) => ({
    ...c,
    vencimento_aberto: pendingByClient.get(c.id)?.vencimento ?? null,
  }));

  return <CarteiraClient clients={rows} pixKey={pixKey} />;
}
