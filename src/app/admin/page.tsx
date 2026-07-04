import { AlertTriangle, Banknote, Coins, Store, TrendingUp } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, currentCompetencia, formatCompetencia } from "@/lib/format";
import type { Client, CommissionEntry, Profile, Withdrawal } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Visão geral" };

export default async function AdminHomePage() {
  await requireAdmin();
  const supabase = await createClient();
  const competencia = currentCompetencia();

  const [clientsRes, entriesRes, sellersRes, withdrawalsRes] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase
      .from("commission_entries")
      .select("seller_id, valor_cents")
      .eq("competencia", competencia),
    supabase.from("profiles").select("*").eq("role", "seller"),
    supabase.from("withdrawals").select("*").eq("status", "solicitado"),
  ]);

  const clients = (clientsRes.data ?? []) as Client[];
  const entries = (entriesRes.data ?? []) as Pick<
    CommissionEntry,
    "seller_id" | "valor_cents"
  >[];
  const sellers = (sellersRes.data ?? []) as Profile[];
  const pendingWithdrawals = (withdrawalsRes.data ?? []) as Withdrawal[];

  const ativos = clients.filter((c) => c.status === "ativo");
  const inadimplentes = clients.filter((c) => c.status === "inadimplente");
  const mrr = ativos.reduce((s, c) => s + c.mensalidade_cents, 0);
  const comissoesMes = entries.reduce((s, e) => s + e.valor_cents, 0);
  const saquesPendentes = pendingWithdrawals.reduce((s, w) => s + w.valor_cents, 0);
  const pendentesAprovacao = sellers.filter((s) => s.status === "pendente").length;

  const ranking = sellers
    .map((s) => {
      const carteira = clients.filter((c) => c.seller_id === s.id);
      const sellerAtivos = carteira.filter((c) => c.status === "ativo");
      return {
        id: s.id,
        nome: s.nome || s.email,
        ref: s.ref_code,
        status: s.status,
        ativos: sellerAtivos.length,
        total: carteira.length,
        mrr: sellerAtivos.reduce((sum, c) => sum + c.mensalidade_cents, 0),
        comissaoMes: entries
          .filter((e) => e.seller_id === s.id)
          .reduce((sum, e) => sum + e.valor_cents, 0),
      };
    })
    .sort((a, b) => b.mrr - a.mrr || b.comissaoMes - a.comissaoMes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Visão geral
        </h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {formatCompetencia(competencia)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="MRR total"
          value={formatBRL(mrr)}
          hint={`${ativos.length} clientes ativos`}
          icon={TrendingUp}
        />
        <StatCard
          label="Comissões do mês"
          value={formatBRL(comissoesMes)}
          hint="Geradas na competência atual"
          icon={Coins}
        />
        <StatCard
          label="Inadimplentes"
          value={String(inadimplentes.length)}
          hint={`${clients.length} clientes no total`}
          icon={AlertTriangle}
        />
        <StatCard
          label="Saques pendentes"
          value={formatBRL(saquesPendentes)}
          hint={`${pendingWithdrawals.length} solicitação(ões)`}
          icon={Banknote}
        />
      </div>

      {pendentesAprovacao > 0 && (
        <Card className="border-primary/40">
          <CardContent className="flex items-center gap-3 text-sm">
            <Store className="size-4 shrink-0 text-primary" />
            <p>
              <span className="font-medium">{pendentesAprovacao} vendedor(es)</span>{" "}
              aguardando aprovação em{" "}
              <a href="/admin/vendedores" className="text-primary hover:underline">
                Vendedores
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">
            Ranking de vendedores
          </CardTitle>
          <CardDescription>
            Por MRR da carteira ativa e comissões na competência atual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum vendedor cadastrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="hidden sm:table-cell">Código</TableHead>
                    <TableHead className="text-right">Clientes ativos</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Comissão no mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {r.ref ?? "—"}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {r.ativos}
                        <span className="text-muted-foreground"> / {r.total}</span>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatBRL(r.mrr)}
                      </TableCell>
                      <TableCell className="tabular text-right text-primary">
                        {formatBRL(r.comissaoMes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
