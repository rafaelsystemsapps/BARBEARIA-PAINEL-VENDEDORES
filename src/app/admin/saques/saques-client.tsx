"use client";

import { useState } from "react";
import { Banknote, CheckCircle2, XCircle } from "lucide-react";
import { payWithdrawal, refuseWithdrawal } from "@/lib/actions/admin";
import type { Withdrawal } from "@/lib/types";
import { formatBRL, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type WithdrawalRow = Withdrawal & {
  profiles: { nome: string; email: string; whatsapp: string | null } | null;
};

export function SaquesClient({
  pending,
  history,
}: {
  pending: WithdrawalRow[];
  history: WithdrawalRow[];
}) {
  const [refusing, setRefusing] = useState<WithdrawalRow | null>(null);
  const [paying, setPaying] = useState<WithdrawalRow | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Saques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transfira o PIX manualmente e marque como pago — as comissões usadas
          ficam rastreadas no saque.
        </p>
      </div>

      {pending.length === 0 ? (
        <EmptyState message="Nenhuma solicitação pendente." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pending.map((w) => (
            <Card key={w.id} className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between font-heading text-base">
                  <span className="flex items-center gap-2">
                    <Banknote className="size-4 text-primary" />
                    {w.profiles?.nome ?? "Vendedor"}
                  </span>
                  <span className="tabular text-xl text-primary">
                    {formatBRL(w.valor_cents)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Titular</p>
                  <p className="font-medium">{w.pix_name}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Chave PIX</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-xs">{w.pix_key}</p>
                    <CopyButton value={w.pix_key} label="Copiar" size="sm" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Solicitado em {formatDateTime(w.requested_at)}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setPaying(w)}>
                    <CheckCircle2 className="size-4" />
                    Marcar como pago
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setRefusing(w)}
                  >
                    <XCircle className="size-4" />
                    Recusar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum saque processado.</p>
        ) : (
          <DataTableCard>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="hidden sm:table-cell">Chave PIX</TableHead>
                <TableHead className="hidden md:table-cell">Solicitado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    {w.profiles?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatBRL(w.valor_cents)}
                  </TableCell>
                  <TableCell className="hidden max-w-44 truncate sm:table-cell text-muted-foreground">
                    {w.pix_key}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDateTime(w.requested_at)}
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
      </section>

      <PayDialog withdrawal={paying} onOpenChange={() => setPaying(null)} />
      <RefuseDialog withdrawal={refusing} onOpenChange={() => setRefusing(null)} />
    </div>
  );
}

function PayDialog({
  withdrawal,
  onOpenChange,
}: {
  withdrawal: WithdrawalRow | null;
  onOpenChange: () => void;
}) {
  const { isPending: pending, executeAction } = useServerAction();

  function pay() {
    if (!withdrawal) return;
    executeAction(() => payWithdrawal(withdrawal.id), {
      successMessage: "Saque pago.",
      onSuccess: onOpenChange,
    });
  }

  return (
    <Dialog open={Boolean(withdrawal)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Confirmar pagamento do saque</DialogTitle>
          <DialogDescription>
            Você já transferiu {withdrawal ? formatBRL(withdrawal.valor_cents) : ""}{" "}
            via PIX para {withdrawal?.pix_name}? As comissões deste saque serão
            marcadas como sacadas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onOpenChange} disabled={pending}>
            Ainda não
          </Button>
          <Button onClick={pay} disabled={pending}>
            {pending ? "Salvando..." : "Sim, já paguei"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RefuseDialog({
  withdrawal,
  onOpenChange,
}: {
  withdrawal: WithdrawalRow | null;
  onOpenChange: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const { isPending: pending, executeAction } = useServerAction();

  function refuse() {
    if (!withdrawal) return;
    executeAction(() => refuseWithdrawal(withdrawal.id, motivo), {
      successMessage: "Saque recusado.",
      onSuccess: () => {
        setMotivo("");
        onOpenChange();
      },
    });
  }

  return (
    <Dialog open={Boolean(withdrawal)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Recusar saque</DialogTitle>
          <DialogDescription>
            O valor volta ao saldo do vendedor. Informe o motivo — ele verá essa
            mensagem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rf-motivo">Motivo da recusa</Label>
            <Input
              id="rf-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: chave PIX divergente do titular"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={pending || motivo.trim().length < 3}
            onClick={refuse}
          >
            {pending ? "Salvando..." : "Recusar saque"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
