import {
  AlertTriangle,
  Banknote,
  Coins,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, currentCompetencia } from "@/lib/format";
import type { Client, Lead, Profile } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { CopyButton } from "@/components/copy-button";
import { BonusSimulator } from "./bonus-simulator";
import { Card, CardContent } from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Meu time" };

type SellerLite = Pick<Profile, "id" | "nome" | "email" | "status">;
type ClientLite = Pick<
  Client,
  "id" | "seller_id" | "status" | "mensalidade_cents" | "barbearia" | "pct_gestor_recorrente"
>;
type LeadLite = Pick<Lead, "id" | "seller_id" | "status">;
type EntryLite = { valor_cents: number; competencia: string; status: string };
type OverduePayment = { client_id: string; vencimento: string };

export default async function GestorHome() {
  const gestor = await requireGestor();
  const supabase = await createClient();

  const [sellersRes, clientsRes, leadsRes, balanceRes, entriesRes, overdueRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, email, status")
        .eq("gestor_id", gestor.id),
      supabase
        .from("clients")
        .select(
          "id, seller_id, status, mensalidade_cents, barbearia, pct_gestor_recorrente"
        )
        .eq("gestor_id", gestor.id),
      supabase.from("leads").select("id, seller_id, status"),
      supabase.rpc("seller_balance"),
      supabase
        .from("commission_entries")
        .select("valor_cents, competencia, status")
        .eq("seller_id", gestor.id),
      supabase
        .from("payments")
        .select("client_id, vencimento")
        .eq("status", "aguardando")
        .lt("vencimento", new Date().toISOString().slice(0, 10)),
    ]);

  const sellers = (sellersRes.data ?? []) as SellerLite[];
  const clients = (clientsRes.data ?? []) as ClientLite[];
  const leads = (leadsRes.data ?? []) as LeadLite[];
  const saldo = Number(balanceRes.data ?? 0);
  const entries = (entriesRes.data ?? []) as EntryLite[];
  const overdue = (overdueRes.data ?? []) as OverduePayment[];

  const sellerIds = new Set(sellers.map((s) => s.id));
  const ativos = clients.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((s, c) => s + c.mensalidade_cents, 0);

  const comp = currentCompetencia();
  const overrideMes = entries
    .filter((e) => e.competencia.startsWith(comp))
    .reduce((s, e) => s + e.valor_cents, 0);

  // Override previsto: o que o gestor recebe quando as mensalidades
  // dos clientes ativos forem confirmadas neste ciclo.
  const overridePrevisto = ativos.reduce(
    (s, c) =>
      s + Math.floor((c.mensalidade_cents * (c.pct_gestor_recorrente ?? 0)) / 100),
    0
  );

  // Funil agregado do time (leads dos vendedores do time).
  const teamLeads = leads.filter((l) => sellerIds.has(l.seller_id));
  const emNegociacao = teamLeads.filter(
    (l) => l.status === "em_negociacao" || l.status === "novo"
  ).length;
  const fechados = teamLeads.filter((l) => l.status === "fechado").length;
  const perdidos = teamLeads.filter((l) => l.status === "perdido").length;
  const decididos = fechados + perdidos;
  const conversao = decididos > 0 ? Math.round((fechados / decididos) * 100) : 0;

  // Inadimplência: clientes do time com cobrança vencida em aberto.
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const overdueClients = Array.from(
    new Map(
      overdue
        .filter((p) => clientById.has(p.client_id))
        .map((p) => [p.client_id, clientById.get(p.client_id)!])
    ).values()
  );

  const sellerName = (id: string) =>
    sellers.find((s) => s.id === id)?.nome ?? "—";

  // Ranking do time por override que cada vendedor rende ao gestor.
  const ranking = sellers
    .map((s) => {
      const carteira = ativos.filter((c) => c.seller_id === s.id);
      const sellerMrr = carteira.reduce((sum, c) => sum + c.mensalidade_cents, 0);
      const overrideGerado = carteira.reduce(
        (sum, c) =>
          sum +
          Math.floor((c.mensalidade_cents * (c.pct_gestor_recorrente ?? 0)) / 100),
        0
      );
      return { ...s, clientes: carteira.length, sellerMrr, overrideGerado };
    })
    .sort((a, b) => b.overrideGerado - a.overrideGerado);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Meu time
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o desempenho do time e o override gerado pelas vendas.
          </p>
        </div>
        {gestor.team_code && (
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">Código do time</p>
            <p className="flex items-center gap-2 font-heading font-semibold">
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                {gestor.team_code}
              </code>
              <CopyButton value={gestor.team_code} />
            </p>
          </div>
        )}
      </div>

      {/* Cards principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo disponível"
          value={formatBRL(saldo)}
          icon={Banknote}
        />
        <StatCard
          label="Override do mês"
          value={formatBRL(overrideMes)}
          hint="Já confirmado"
          icon={Coins}
        />
        <StatCard
          label="Override previsto"
          value={formatBRL(overridePrevisto)}
          hint="Ao confirmar as mensalidades"
          icon={TrendingUp}
        />
        <StatCard
          label="MRR do time"
          value={formatBRL(mrr)}
          icon={Users}
        />
      </div>

      {/* Funil agregado */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Em negociação" value={String(emNegociacao)} />
        <StatCard label="Fechados" value={String(fechados)} />
        <StatCard label="Perdidos" value={String(perdidos)} />
        <StatCard
          label="Conversão do time"
          value={`${conversao}%`}
          hint="Fechados ÷ decididos"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="space-y-6">
          {/* Ranking do time */}
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <Trophy className="size-4 text-primary" />
              Ranking do time
            </h2>
            {sellers.length === 0 ? (
              <EmptyState message="Nenhum vendedor no time ainda. Compartilhe seu código para que vendedores entrem." />
            ) : (
              <DataTableCard>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">
                      MRR gerado
                    </TableHead>
                    <TableHead className="text-right">Seu override</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="tabular text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.nome || sellerName(s.id)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {s.clientes}
                      </TableCell>
                      <TableCell className="tabular hidden sm:table-cell text-right text-muted-foreground">
                        {formatBRL(s.sellerMrr)}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium text-primary">
                        {formatBRL(s.overrideGerado)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTableCard>
            )}
          </div>

          {/* Inadimplência */}
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Clientes em atraso
              {overdueClients.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                  {overdueClients.length}
                </span>
              )}
            </h2>
            {overdueClients.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum cliente do time em atraso. 🎉
                </CardContent>
              </Card>
            ) : (
              <DataTableCard>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barbearia</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Mensalidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueClients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.barbearia}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sellerName(c.seller_id)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatBRL(c.mensalidade_cents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTableCard>
            )}
            <p className="text-xs text-muted-foreground">
              Cliente em atraso = override que você deixa de receber. Vale a pena
              apoiar o vendedor na cobrança.
            </p>
          </div>
        </div>

        {/* Simulador de bônus */}
        <BonusSimulator
          overrideRecorrente={gestor.override_recorrente_pct}
          overrideSetup={gestor.override_setup_pct}
          bonusRecorrente={gestor.bonus_time_pct}
          bonusSetup={gestor.bonus_time_setup_pct}
        />
      </div>
    </div>
  );
}
