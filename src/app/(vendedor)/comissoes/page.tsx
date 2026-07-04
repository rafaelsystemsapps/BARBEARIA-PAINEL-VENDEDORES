import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatCompetencia } from "@/lib/format";
import type { CommissionEntry } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Comissões" };

type EntryRow = CommissionEntry & {
  clients: { barbearia: string; pct_recorrente: number; pct_setup: number | null } | null;
  payments: { valor_pago_cents: number | null } | null;
};

export default async function ComissoesPage() {
  await requireSeller();
  const supabase = await createClient();

  const { data } = await supabase
    .from("commission_entries")
    .select(
      "*, clients(barbearia, pct_recorrente, pct_setup), payments(valor_pago_cents)"
    )
    .order("competencia", { ascending: false })
    .order("created_at", { ascending: false });

  const entries = (data ?? []) as unknown as EntryRow[];

  const byCompetencia = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const list = byCompetencia.get(e.competencia) ?? [];
    list.push(e);
    byCompetencia.set(e.competencia, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Comissões
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Extrato mês a mês. A comissão nasce quando o administrador confirma o
          pagamento do cliente.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma comissão ainda. Assim que um pagamento for confirmado, ela
            aparece aqui.
          </p>
        </div>
      ) : (
        Array.from(byCompetencia.entries()).map(([competencia, list]) => {
          const total = list.reduce((s, e) => s + e.valor_cents, 0);
          return (
            <section key={competencia} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-base font-semibold capitalize">
                  {formatCompetencia(competencia)}
                </h2>
                <p className="tabular text-sm text-muted-foreground">
                  Total: <span className="text-primary">{formatBRL(total)}</span>
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">
                        Valor pago
                      </TableHead>
                      <TableHead className="hidden sm:table-cell text-right">
                        %
                      </TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((e) => {
                      const pct =
                        e.tipo === "setup"
                          ? e.clients?.pct_setup
                          : e.clients?.pct_recorrente;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">
                            {e.clients?.barbearia ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {e.tipo === "setup" ? "Setup" : "Mensalidade"}
                          </TableCell>
                          <TableCell className="tabular hidden sm:table-cell text-right text-muted-foreground">
                            {e.payments?.valor_pago_cents
                              ? formatBRL(e.payments.valor_pago_cents)
                              : "—"}
                          </TableCell>
                          <TableCell className="tabular hidden sm:table-cell text-right text-muted-foreground">
                            {pct ? `${pct}%` : "—"}
                          </TableCell>
                          <TableCell className="tabular text-right font-medium text-primary">
                            {formatBRL(e.valor_cents)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={e.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
