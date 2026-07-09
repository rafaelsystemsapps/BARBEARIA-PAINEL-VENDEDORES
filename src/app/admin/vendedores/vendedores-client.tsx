"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  MoreHorizontal,
  Pause,
  Play,
  Store,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveSeller,
  setSellerStatus,
  setSellerTeam,
} from "@/lib/actions/admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionState } from "@/lib/actions/auth";
import type { Client, Profile } from "@/lib/types";
import { formatBRL, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
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

type ClientLite = Pick<Client, "id" | "seller_id" | "status" | "mensalidade_cents">;
type GestorLite = Pick<Profile, "id" | "nome" | "email" | "team_code" | "status">;

export function VendedoresClient({
  sellers,
  clients,
  gestores,
}: {
  sellers: Profile[];
  clients: ClientLite[];
  gestores: GestorLite[];
}) {
  const [approving, setApproving] = useState<Profile | null>(null);
  const [linking, setLinking] = useState<Profile | null>(null);
  const [pending, startTransition] = useTransition();

  const gestorById = new Map(gestores.map((g) => [g.id, g]));

  function toggleStatus(seller: Profile) {
    const novo = seller.status === "pausado" ? "ativo" : "pausado";
    startTransition(async () => {
      const res = await setSellerStatus(seller.id, novo);
      if (res?.error) toast.error(res.error);
      else toast.success(res?.success ?? "Atualizado.");
    });
  }

  const stats = (sellerId: string) => {
    const carteira = clients.filter((c) => c.seller_id === sellerId);
    const ativos = carteira.filter((c) => c.status === "ativo");
    return {
      ativos: ativos.length,
      total: carteira.length,
      mrr: ativos.reduce((s, c) => s + c.mensalidade_cents, 0),
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Vendedores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprove cadastros definindo o código do vendedor, pause ou reative
          parceiros.
        </p>
      </div>

      {sellers.length === 0 ? (
        <EmptyState message="Nenhum vendedor cadastrado ainda." />
      ) : (
        <DataTableCard>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="hidden md:table-cell">Contato</TableHead>
                <TableHead className="hidden sm:table-cell">Código</TableHead>
                <TableHead className="hidden md:table-cell">Time / Gestor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell text-right">
                  Carteira
                </TableHead>
                <TableHead className="hidden lg:table-cell text-right">MRR</TableHead>
                <TableHead className="hidden xl:table-cell">Cadastro</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((s) => {
                const st = stats(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {s.whatsapp ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {s.ref_code ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {s.ref_code}
                        </code>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {s.gestor_id && gestorById.has(s.gestor_id) ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {gestorById.get(s.gestor_id)!.nome}
                          </span>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs w-fit">
                            {gestorById.get(s.gestor_id)!.team_code}
                          </code>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Direto</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="tabular hidden lg:table-cell text-right">
                      {st.ativos}
                      <span className="text-muted-foreground"> / {st.total}</span>
                    </TableCell>
                    <TableCell className="tabular hidden lg:table-cell text-right">
                      {formatBRL(st.mrr)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {formatDate(s.created_at)}
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
                          {s.status === "pendente" && (
                            <DropdownMenuItem onClick={() => setApproving(s)}>
                              <BadgeCheck className="size-4" />
                              Aprovar…
                            </DropdownMenuItem>
                          )}
                          {s.status === "ativo" && (
                            <DropdownMenuItem onClick={() => toggleStatus(s)}>
                              <Pause className="size-4" />
                              Pausar
                            </DropdownMenuItem>
                          )}
                          {s.status === "pausado" && (
                            <DropdownMenuItem onClick={() => toggleStatus(s)}>
                              <Play className="size-4" />
                              Reativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setLinking(s)}>
                            <Users className="size-4" />
                            Gerenciar time…
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/vendedores/${s.id}`}>
                              <Store className="size-4" />
                              Ver carteira
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTableCard>
      )}

      <ApproveDialog seller={approving} onOpenChange={() => setApproving(null)} />
      <LinkTeamDialog
        seller={linking}
        gestores={gestores}
        onOpenChange={() => setLinking(null)}
      />
    </div>
  );
}

function LinkTeamDialog({
  seller,
  gestores,
  onOpenChange,
}: {
  seller: Profile | null;
  gestores: GestorLite[];
  onOpenChange: () => void;
}) {
  if (!seller) return null;
  return (
    <LinkTeamDialogContent
      key={seller.id}
      seller={seller}
      gestores={gestores}
      onOpenChange={onOpenChange}
    />
  );
}

function LinkTeamDialogContent({
  seller,
  gestores,
  onOpenChange,
}: {
  seller: Profile;
  gestores: GestorLite[];
  onOpenChange: () => void;
}) {
  const [value, setValue] = useState<string>(seller.gestor_id ?? "none");
  const [pending, startTransition] = useTransition();

  const activeGestores = gestores.filter((g) => g.status === "ativo");

  function save() {
    startTransition(async () => {
      const res = await setSellerTeam(
        seller.id,
        value === "none" ? null : value
      );
      if (res?.error) toast.error(res.error);
      else {
        toast.success(res?.success ?? "Atualizado.");
        onOpenChange();
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Time do vendedor</DialogTitle>
          <DialogDescription>
            {seller.nome || seller.email} — vincule a um gestor, transfira de
            time ou deixe como vendedor direto. Vale para vendas futuras; os
            clientes já fechados mantêm o gestor registrado no fechamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Gestor / time</Label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem time (vendedor direto)</SelectItem>
                {activeGestores.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome} — {g.team_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Salvar vínculo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDialog({
  seller,
  onOpenChange,
}: {
  seller: Profile | null;
  onOpenChange: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    approveSeller,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onOpenChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!seller) return null;

  const sugestao = (seller.nome || seller.email)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Aprovar vendedor</DialogTitle>
          <DialogDescription>
            {seller.nome || seller.email} — defina o código único usado no link de
            demonstração (ex.: joao123).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="profile_id" value={seller.id} />
          <div className="space-y-2">
            <Label htmlFor="ap-ref">Código do vendedor (ref_code)</Label>
            <Input
              id="ap-ref"
              name="ref_code"
              defaultValue={sugestao}
              placeholder="joao123"
              required
            />
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Aprovando..." : "Aprovar e liberar acesso"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
