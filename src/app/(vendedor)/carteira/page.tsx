import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatDate } from "@/lib/format";
import type { Client } from "@/lib/types";
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

export const metadata = { title: "Minha carteira" };

export default async function CarteiraPage() {
  await requireSeller();
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("closed_at", { ascending: false });

  const clients = (data ?? []) as Client[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Minha carteira
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes fechados por você. Comissão recorrente é vitalícia enquanto o
          cliente pagar.
        </p>
      </div>

      {clients.length === 0 ? (
        <EmptyState message="Nenhum cliente na carteira ainda. Feche sua primeira venda na tela de Leads." />
      ) : (
        <DataTableCard>
            <TableHeader>
              <TableRow>
                <TableHead>Barbearia</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="text-right">% recorrente</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Setup
                </TableHead>
                <TableHead className="hidden lg:table-cell">Vencimento</TableHead>
                <TableHead className="hidden lg:table-cell">Fechado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.barbearia}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.cidade ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatBRL(c.mensalidade_cents)}
                  </TableCell>
                  <TableCell className="tabular text-right text-primary">
                    {c.pct_recorrente}%
                  </TableCell>
                  <TableCell className="tabular hidden md:table-cell text-right text-muted-foreground">
                    {c.tem_setup && c.setup_cents
                      ? `${formatBRL(c.setup_cents)} (${c.pct_setup}%)`
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    Dia {c.dia_vencimento}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(c.closed_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTableCard>
      )}
    </div>
  );
}
