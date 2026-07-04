"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, MoreHorizontal, XCircle } from "lucide-react";
import { toast } from "sonner";
import { setClientStatus } from "@/lib/actions/admin";
import type { Client } from "@/lib/types";
import { formatBRL, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ClientRow = Client & { profiles: { nome: string } | null };

export function ClientesClient({ clients }: { clients: ClientRow[] }) {
  const [canceling, setCanceling] = useState<ClientRow | null>(null);
  const [pending, startTransition] = useTransition();

  function change(client: ClientRow, status: "ativo" | "inadimplente") {
    startTransition(async () => {
      const res = await setClientStatus(client.id, status);
      if (res?.error) toast.error(res.error);
      else toast.success(res?.success ?? "Atualizado.");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as barbearias fechadas pelos vendedores. Só você altera o status.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum cliente ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbearia</TableHead>
                <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="hidden sm:table-cell text-right">
                  % rec.
                </TableHead>
                <TableHead className="hidden lg:table-cell">Vencimento</TableHead>
                <TableHead className="hidden lg:table-cell">Fechado em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium">{c.barbearia}</p>
                    <p className="text-xs text-muted-foreground">{c.cidade ?? ""}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.profiles?.nome ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatBRL(c.mensalidade_cents)}
                  </TableCell>
                  <TableCell className="tabular hidden sm:table-cell text-right text-primary">
                    {c.pct_recorrente}%
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    Dia {c.dia_vencimento}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(c.closed_at)}
                  </TableCell>
                  <TableCell>
                    {c.status !== "cancelado" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label="Ações"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.status !== "ativo" && (
                            <DropdownMenuItem onClick={() => change(c, "ativo")}>
                              <CheckCircle2 className="size-4" />
                              Marcar como ativo
                            </DropdownMenuItem>
                          )}
                          {c.status === "ativo" && (
                            <DropdownMenuItem
                              onClick={() => change(c, "inadimplente")}
                            >
                              <AlertTriangle className="size-4" />
                              Marcar inadimplente
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setCanceling(c)}
                          >
                            <XCircle className="size-4" />
                            Cancelar cliente…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CancelDialog client={canceling} onOpenChange={() => setCanceling(null)} />
    </div>
  );
}

function CancelDialog({
  client,
  onOpenChange,
}: {
  client: ClientRow | null;
  onOpenChange: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (!client) return;
    startTransition(async () => {
      const res = await setClientStatus(client.id, "cancelado");
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Cliente cancelado.");
        onOpenChange();
      }
    });
  }

  return (
    <Dialog open={Boolean(client)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Cancelar cliente</DialogTitle>
          <DialogDescription>
            {client?.barbearia} deixará de gerar cobranças mensais e comissões. As
            comissões já geradas não são afetadas. Essa ação pode ser revertida
            reativando o cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onOpenChange} disabled={pending}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={cancel} disabled={pending}>
            {pending ? "Cancelando..." : "Cancelar cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
