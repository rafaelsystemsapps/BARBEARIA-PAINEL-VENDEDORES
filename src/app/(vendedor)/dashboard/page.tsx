import { Banknote, Coins, Store, TrendingUp } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatDate, currentCompetencia } from "@/lib/format";
import type { Client, CommissionEntry } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { DemoLinkCard } from "@/components/demo-link-card";
import { CopyButton } from "@/components/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

type EntryWithClient = CommissionEntry & { clients: { barbearia: string } | null };

export default async function DashboardPage() {
  const profile = await requireSeller();
  const supabase = await createClient();
  const competencia = currentCompetencia();

  const [balanceRes, clientsRes, setupsRes, demoRes, recentRes] =
    await Promise.all([
      supabase.rpc("seller_balance"),
      supabase.from("clients").select("*"),
      supabase
        .from("payments")
        .select("valor_esperado_cents, clients!inner(seller_id, pct_setup)")
        .eq("tipo", "setup")
        .eq("status", "aguardando")
        .eq("clients.seller_id", profile.id),
      supabase
        .from("settings")
        .select("key, value")
        .in("key", ["demo_url", "admin_pix_key"]),
      supabase
        .from("commission_entries")
        .select("*, clients(barbearia)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const saldo = Number(balanceRes.data ?? 0);
  const clients = (clientsRes.data ?? []) as Client[];
  const ativos = clients.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((sum, c) => sum + c.mensalidade_cents, 0);

  const previstoRecorrente = ativos.reduce(
    (sum, c) => sum + Math.round((c.mensalidade_cents * c.pct_recorrente) / 100),
    0
  );
  const previstoSetup = (
    (setupsRes.data ?? []) as unknown as {
      valor_esperado_cents: number;
      clients: { pct_setup: number | null };
    }[]
  ).reduce(
    (sum, p) =>
      sum + Math.round((p.valor_esperado_cents * (p.clients?.pct_setup ?? 0)) / 100),
    0
  );

  const recentes = (recentRes.data ?? []) as EntryWithClient[];
  const settings = new Map(
    ((demoRes.data ?? []) as { key: string; value: string }[]).map((s) => [
      s.key,
      s.value,
    ])
  );
  const demoUrl = settings.get("demo_url")?.trim() || null;
  const adminPixKey = settings.get("admin_pix_key")?.trim() || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Olá, {(profile.nome || "parceiro").split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Competência atual: {competencia.slice(5, 7)}/{competencia.slice(0, 4)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo disponível"
          value={formatBRL(saldo)}
          hint="Pronto para saque"
          icon={Banknote}
        />
        <StatCard
          label="Comissão prevista no mês"
          value={formatBRL(previstoRecorrente + previstoSetup)}
          hint="Se todos os clientes pagarem"
          icon={Coins}
        />
        <StatCard
          label="Clientes ativos"
          value={String(ativos.length)}
          hint={`${clients.length} na carteira total`}
          icon={Store}
        />
        <StatCard
          label="MRR da carteira"
          value={formatBRL(mrr)}
          hint="Mensalidades dos ativos"
          icon={TrendingUp}
        />
      </div>

      {adminPixKey && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">Chave PIX para cobrança dos clientes</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {adminPixKey}
              </p>
            </div>
            <CopyButton value={adminPixKey} label="Copiar chave" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DemoLinkCard demoUrl={demoUrl} refCode={profile.ref_code} />

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Últimos lançamentos
            </CardTitle>
            <CardDescription>Comissões geradas mais recentes.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma comissão ainda. Feche sua primeira venda para começar!
              </p>
            ) : (
              <ul className="space-y-3">
                {recentes.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {e.clients?.barbearia ?? "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.tipo === "setup" ? "Setup" : "Mensalidade"} ·{" "}
                        {formatDate(e.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular font-medium text-primary">
                        {formatBRL(e.valor_cents)}
                      </span>
                      <StatusBadge status={e.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
