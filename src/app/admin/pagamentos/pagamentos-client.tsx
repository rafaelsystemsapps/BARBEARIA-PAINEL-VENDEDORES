"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { confirmPayment, generateCharges } from "@/lib/actions/admin";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { useServerAction } from "@/lib/hooks/use-server-action";
import type { ActionState } from "@/lib/actions/auth";
import type { Payment } from "@/lib/types";
import { formatBRL, formatCompetencia, formatDate } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export type PaymentRow = Payment & {
  clients: {
    barbearia: string;
    dia_vencimento: number | null;
    profiles: { nome: string } | null;
  } | null;
};

function diasVencidos(vencimento: string): number {
  const hoje = new Date();
  const venc = new Date(`${vencimento}T12:00:00`);
  return Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000);
}

export function PagamentosClient({
  pending,
  recent,
  diasAlerta,
}: {
  pending: PaymentRow[];
  recent: PaymentRow[];
  diasAlerta: number;
}) {
  const [confirming, setConfirming] = useState<PaymentRow | null>(null);
  const { isPending: generating, executeAction: runGenerateAction } = useServerAction();

  function runGenerate() {
    runGenerateAction(generateCharges, {
      successMessage: "Cobranças geradas.",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Confirmar pagamentos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirme aqui cada PIX recebido — é isso que gera a comissão do
            vendedor.
          </p>
        </div>
        <Button variant="outline" onClick={runGenerate} disabled={generating}>
          <RefreshCw className={generating ? "size-4 animate-spin" : "size-4"} />
          Gerar cobranças do mês
        </Button>
      </div>

      {pending.length === 0 ? (
        <EmptyState message="Nenhuma cobrança aguardando. Gere as cobranças do mês ou aguarde novos fechamentos." />
      ) : (
        <DataTableCard>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden sm:table-cell">Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => {
                const atraso = diasVencidos(p.vencimento);
                const alerta = atraso >= diasAlerta;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.clients?.barbearia ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {p.clients?.profiles?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.tipo === "setup" ? "Setup" : "Mensalidade"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell capitalize text-muted-foreground">
                      {formatCompetencia(p.competencia)}
                    </TableCell>
                    <TableCell>
                      <span className={alerta ? "text-red-300" : undefined}>
                        {formatDate(p.vencimento)}
                      </span>
                      {alerta && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-red-400/30 bg-red-400/10 text-red-300"
                        >
                          <AlertTriangle className="size-3" />
                          {atraso}d em atraso
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatBRL(p.valor_esperado_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setConfirming(p)}>
                        <BadgeCheck className="size-4" />
                        Confirmar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTableCard>
      )}

      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">
          Confirmados recentemente
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pagamento confirmado ainda.
          </p>
        ) : (
          <DataTableCard>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Competência</TableHead>
                  <TableHead className="text-right">Valor pago</TableHead>
                  <TableHead className="hidden md:table-cell">Confirmado em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.clients?.barbearia ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.tipo === "setup" ? "Setup" : "Mensalidade"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell capitalize text-muted-foreground">
                      {formatCompetencia(p.competencia)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatBRL(p.valor_pago_cents ?? p.valor_esperado_cents)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {p.confirmed_at ? formatDate(p.confirmed_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </DataTableCard>
        )}
      </section>

      <ConfirmDialog payment={confirming} onOpenChange={() => setConfirming(null)} />
    </div>
  );
}

function ConfirmDialog({
  payment,
  onOpenChange,
}: {
  payment: PaymentRow | null;
  onOpenChange: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    confirmPayment,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onOpenChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!payment) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Confirmar recebimento</DialogTitle>
          <DialogDescription>
            {payment.clients?.barbearia} ·{" "}
            {payment.tipo === "setup" ? "setup" : "mensalidade"} de{" "}
            {formatBRL(payment.valor_esperado_cents)}. Ajuste o valor se o PIX
            recebido foi diferente.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="payment_id" value={payment.id} />
          <div className="space-y-2">
            <Label htmlFor="cp-valor">Valor recebido</Label>
            <MoneyInput
              id="cp-valor"
              name="valor_pago_cents"
              defaultCents={payment.valor_esperado_cents}
              required
            />
          </div>

          {payment.tipo === "mensalidade" && (
            <div className="space-y-2">
              <Label htmlFor="cp-dia">Dia de vencimento da mensalidade</Label>
              <input
                id="cp-dia"
                name="dia_vencimento"
                type="number"
                min={1}
                max={31}
                required
                defaultValue={payment.clients?.dia_vencimento ?? ""}
                placeholder="Ex.: 10"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Este será o dia fixo de vencimento nos próximos meses. Em meses
                mais curtos, ajusta para o último dia.
              </p>
            </div>
          )}

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Confirmando..." : "Confirmar e gerar comissão"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
