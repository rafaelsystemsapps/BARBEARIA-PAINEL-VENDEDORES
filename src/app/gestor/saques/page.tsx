import { Banknote } from "lucide-react";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Withdrawal } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { WithdrawalForm } from "@/app/(vendedor)/saques/withdrawal-form";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Saques" };

export default async function GestorSaquesPage() {
  const profile = await requireGestor();
  const supabase = await createClient();

  const [balanceRes, withdrawalsRes, minRes] = await Promise.all([
    supabase.rpc("seller_balance"),
    supabase
      .from("withdrawals")
      .select("*")
      .order("requested_at", { ascending: false }),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "saque_minimo_cents")
      .single(),
  ]);

  const saldo = Number(balanceRes.data ?? 0);
  const withdrawals = (withdrawalsRes.data ?? []) as Withdrawal[];
  const minimo = parseInt(minRes.data?.value ?? "5000", 10) || 5000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Saques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicite o saque do override acumulado — o pagamento é feito por PIX
          pelo administrador.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-4">
          <StatCard
            label="Saldo disponível"
            value={formatBRL(saldo)}
            hint={`Saque mínimo: ${formatBRL(minimo)}`}
            icon={Banknote}
          />
          <WithdrawalForm
            saldoCents={saldo}
            minimoCents={minimo}
            defaultPixKey={profile.pix_key ?? ""}
            defaultPixName={profile.pix_name ?? profile.nome ?? ""}
          />
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Histórico</h2>
          {withdrawals.length === 0 ? (
            <EmptyState message="Nenhum saque solicitado ainda." />
          ) : (
            <DataTableCard>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Chave PIX
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(w.requested_at)}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatBRL(w.valor_cents)}
                    </TableCell>
                    <TableCell className="hidden max-w-40 truncate sm:table-cell text-muted-foreground">
                      {w.pix_key}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                      {w.status === "recusado" && w.motivo_recusa && (
                        <p className="mt-1 max-w-45 truncate text-xs text-muted-foreground">
                          {w.motivo_recusa}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTableCard>
          )}
        </div>
      </div>
    </div>
  );
}
