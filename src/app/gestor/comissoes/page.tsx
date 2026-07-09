import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatCompetencia } from "@/lib/format";
import type { CommissionEntry } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Comissões" };

type EntryRow = CommissionEntry & {
  clients: { barbearia: string } | null;
  payments: { valor_pago_cents: number | null } | null;
};

export default async function GestorComissoesPage() {
  const gestor = await requireGestor();
  const supabase = await createClient();

  const { data } = await supabase
    .from("commission_entries")
    .select("*, clients(barbearia), payments(valor_pago_cents)")
    .eq("seller_id", gestor.id)
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
          Comissões (override do time)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu override nasce junto com a comissão do vendedor, quando o
          administrador confirma o pagamento do cliente.
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState message="Nenhum override ainda. Assim que uma venda do time for paga e confirmada, ela aparece aqui." />
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
              <DataTableCard>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">
                      Valor pago
                    </TableHead>
                    <TableHead className="text-right">Override</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e) => (
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
                      <TableCell className="tabular text-right font-medium text-primary">
                        {formatBRL(e.valor_cents)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTableCard>
            </section>
          );
        })
      )}
    </div>
  );
}
