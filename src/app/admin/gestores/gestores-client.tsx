"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { MoreHorizontal, Pause, Play, Plus, Percent } from "lucide-react";
import { toast } from "sonner";
import {
  createGestor,
  updateGestorOverride,
  setGestorStatus,
} from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/auth";
import type { Client, Profile } from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SellerLite = Pick<Profile, "id" | "nome" | "email" | "gestor_id" | "status">;
type ClientLite = Pick<
  Client,
  "id" | "seller_id" | "gestor_id" | "status" | "mensalidade_cents"
>;

export function GestoresClient({
  gestores,
  sellers,
  clients,
}: {
  gestores: Profile[];
  sellers: SellerLite[];
  clients: ClientLite[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleStatus(g: Profile) {
    const novo = g.status === "pausado" ? "ativo" : "pausado";
    startTransition(async () => {
      const res = await setGestorStatus(g.id, novo);
      if (res?.error) toast.error(res.error);
      else toast.success(res?.success ?? "Atualizado.");
    });
  }

  const teamStats = (gestorId: string) => {
    const timeSellers = sellers.filter((s) => s.gestor_id === gestorId);
    // MRR do time = mensalidades ativas de clientes cujo snapshot aponta o gestor
    const timeClients = clients.filter(
      (c) => c.gestor_id === gestorId && c.status === "ativo"
    );
    return {
      sellers: timeSellers.length,
      mrr: timeClients.reduce((s, c) => s + c.mensalidade_cents, 0),
      clientes: timeClients.length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Gestores
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie gestores, defina o código do time e o percentual de override
            pago sobre as vendas do time.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Novo gestor
        </Button>
      </div>

      {gestores.length === 0 ? (
        <EmptyState message="Nenhum gestor cadastrado ainda." />
      ) : (
        <DataTableCard>
          <TableHeader>
            <TableRow>
              <TableHead>Gestor</TableHead>
              <TableHead>Código do time</TableHead>
              <TableHead className="hidden sm:table-cell text-right">
                Override
              </TableHead>
              <TableHead className="hidden md:table-cell text-right">
                Bônus time
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                Vendedores
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                MRR do time
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {gestores.map((g) => {
              const st = teamStats(g.id);
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <p className="font-medium">{g.nome || "—"}</p>
                    <p className="text-xs text-muted-foreground">{g.email}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {g.team_code}
                      </code>
                      {g.team_code && <CopyButton value={g.team_code} />}
                    </span>
                  </TableCell>
                  <TableCell className="tabular hidden sm:table-cell text-right">
                    {g.override_recorrente_pct}% / {g.override_setup_pct}%
                  </TableCell>
                  <TableCell className="tabular hidden md:table-cell text-right text-muted-foreground">
                    {g.bonus_time_pct}% / {g.bonus_time_setup_pct}%
                  </TableCell>
                  <TableCell className="tabular hidden lg:table-cell text-right">
                    {st.sellers}
                  </TableCell>
                  <TableCell className="tabular hidden lg:table-cell text-right">
                    {formatBRL(st.mrr)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={g.status} />
                  </TableCell>
                  <TableCell>
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
                        <DropdownMenuItem onClick={() => setEditing(g)}>
                          <Percent className="size-4" />
                          Editar override…
                        </DropdownMenuItem>
                        {g.status === "ativo" ? (
                          <DropdownMenuItem onClick={() => toggleStatus(g)}>
                            <Pause className="size-4" />
                            Pausar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => toggleStatus(g)}>
                            <Play className="size-4" />
                            Reativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTableCard>
      )}

      <CreateGestorDialog open={creating} onOpenChange={() => setCreating(false)} />
      <EditOverrideDialog
        gestor={editing}
        onOpenChange={() => setEditing(null)}
      />
    </div>
  );
}

function CreateGestorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createGestor,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onOpenChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Novo gestor</DialogTitle>
          <DialogDescription>
            O gestor recebe override sobre as vendas do time. Ele entra ativo e
            usa a senha provisória para o primeiro acesso.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-nome">Nome</Label>
            <Input id="g-nome" name="nome" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="g-email">E-mail</Label>
              <Input id="g-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-whats">WhatsApp</Label>
              <Input id="g-whats" name="whatsapp" placeholder="11 91234-5678" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-code">Código do time</Label>
            <Input
              id="g-code"
              name="team_code"
              placeholder="TIMECARLOS"
              autoCapitalize="characters"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="g-rec">Override recorrente (%)</Label>
              <Input
                id="g-rec"
                name="override_recorrente_pct"
                type="number"
                min={0}
                max={100}
                defaultValue={10}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-set">Override setup (%)</Label>
              <Input
                id="g-set"
                name="override_setup_pct"
                type="number"
                min={0}
                max={100}
                defaultValue={5}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-pass">Senha provisória (mín. 8)</Label>
            <Input
              id="g-pass"
              name="password"
              type="text"
              minLength={8}
              placeholder="Gestor@2026"
              required
            />
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Criando..." : "Criar gestor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditOverrideDialog({
  gestor,
  onOpenChange,
}: {
  gestor: Profile | null;
  onOpenChange: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateGestorOverride,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onOpenChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!gestor) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">
            Override — {gestor.nome || gestor.email}
          </DialogTitle>
          <DialogDescription>
            Percentual pago ao gestor por fora, sobre cada pagamento do time.
            Vale para vendas futuras; clientes já fechados mantêm o percentual
            do fechamento.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="gestor_id" value={gestor.id} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-rec">Recorrente (%)</Label>
              <Input
                id="e-rec"
                name="override_recorrente_pct"
                type="number"
                min={0}
                max={100}
                defaultValue={gestor.override_recorrente_pct}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-set">Setup (%)</Label>
              <Input
                id="e-set"
                name="override_setup_pct"
                type="number"
                min={0}
                max={100}
                defaultValue={gestor.override_setup_pct}
                required
              />
            </div>
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Salvar override"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
