import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import type { Client, Profile } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { CopyButton } from "@/components/copy-button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Meu time" };

export default async function GestorHome() {
  const gestor = await requireGestor();
  const supabase = await createClient();

  const [sellersRes, clientsRes, balanceRes, entriesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, status")
      .eq("gestor_id", gestor.id),
    supabase
      .from("clients")
      .select("id, seller_id, status, mensalidade_cents")
      .eq("gestor_id", gestor.id),
    supabase.rpc("seller_balance"),
    supabase
      .from("commission_entries")
      .select("valor_cents, competencia")
      .eq("seller_id", gestor.id),
  ]);

  const sellers = (sellersRes.data ?? []) as Pick<
    Profile,
    "id" | "nome" | "email" | "status"
  >[];
  const clients = (clientsRes.data ?? []) as Pick<
    Client,
    "id" | "seller_id" | "status" | "mensalidade_cents"
  >[];
  const saldo = Number(balanceRes.data ?? 0);

  const ativos = clients.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((s, c) => s + c.mensalidade_cents, 0);

  const competenciaAtual = new Date().toISOString().slice(0, 7);
  const overrideMes = ((entriesRes.data ?? []) as { valor_cents: number; competencia: string }[])
    .filter((e) => e.competencia.startsWith(competenciaAtual))
    .reduce((s, e) => s + e.valor_cents, 0);

  const sellerName = (id: string) =>
    sellers.find((s) => s.id === id)?.nome ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Meu time
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe os vendedores do time e o override gerado pelas vendas
            deles.
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Saldo disponível" value={formatBRL(saldo)} />
        <StatCard label="Override do mês" value={formatBRL(overrideMes)} />
        <StatCard label="Vendedores no time" value={String(sellers.length)} />
        <StatCard label="MRR do time" value={formatBRL(mrr)} />
      </div>

      {sellers.length === 0 ? (
        <EmptyState message="Nenhum vendedor no time ainda. Compartilhe seu código para que vendedores entrem no seu time." />
      ) : (
        <DataTableCard>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="hidden sm:table-cell">Contato</TableHead>
              <TableHead className="text-right">Clientes ativos</TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                MRR gerado
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((s) => {
              const carteira = ativos.filter((c) => c.seller_id === s.id);
              const sellerMrr = carteira.reduce(
                (sum, c) => sum + c.mensalidade_cents,
                0
              );
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.nome || sellerName(s.id)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {s.email}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {carteira.length}
                  </TableCell>
                  <TableCell className="tabular hidden lg:table-cell text-right">
                    {formatBRL(sellerMrr)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTableCard>
      )}
    </div>
  );
}
