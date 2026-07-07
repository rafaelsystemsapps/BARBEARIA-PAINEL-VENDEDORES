"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  Handshake,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { createLead, closeLead, updateLeadStatus } from "@/lib/actions/seller";
import type { ActionState } from "@/lib/actions/auth";
import type { Lead, LeadStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Filter = "todos" | LeadStatus;

export function LeadsClient({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [newOpen, setNewOpen] = useState(false);
  const [losing, setLosing] = useState<Lead | null>(null);
  const [closing, setClosing] = useState<Lead | null>(null);

  const filtered =
    filter === "todos" ? leads : leads.filter((l) => l.status === filter);

  const count = (s: LeadStatus) => leads.filter((l) => l.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu funil de vendas: do primeiro contato ao fechamento.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          Novo lead
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="todos">Todos ({leads.length})</TabsTrigger>
          <TabsTrigger value="novo">Novos ({count("novo")})</TabsTrigger>
          <TabsTrigger value="em_negociacao">
            Em negociação ({count("em_negociacao")})
          </TabsTrigger>
          <TabsTrigger value="fechado">Fechados ({count("fechado")})</TabsTrigger>
          <TabsTrigger value="perdido">Perdidos ({count("perdido")})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            leads.length === 0
              ? "Nenhum lead ainda. Cadastre o primeiro contato de barbearia que você abordar."
              : "Nenhum lead neste filtro."
          }
        />
      ) : (
        <DataTableCard>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Barbearia</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.nome_contato}</TableCell>
                  <TableCell>{lead.barbearia}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {lead.cidade ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {lead.whatsapp ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                    {lead.status === "perdido" && lead.motivo_perda && (
                      <p className="mt-1 max-w-45 truncate text-xs text-muted-foreground">
                        {lead.motivo_perda}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(lead.updated_at)}
                  </TableCell>
                  <TableCell>
                    {(lead.status === "novo" || lead.status === "em_negociacao") && (
                      <RowActions
                        lead={lead}
                        onLose={() => setLosing(lead)}
                        onClose={() => setClosing(lead)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </DataTableCard>
      )}

      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} />
      <LoseLeadDialog lead={losing} onOpenChange={() => setLosing(null)} />
      <CloseLeadDialog lead={closing} onOpenChange={() => setClosing(null)} />
    </div>
  );
}

function RowActions({
  lead,
  onLose,
  onClose,
}: {
  lead: Lead;
  onLose: () => void;
  onClose: () => void;
}) {
  const { isPending: pending, executeAction } = useServerAction();

  function move(status: "novo" | "em_negociacao") {
    executeAction(() => updateLeadStatus(lead.id, status), {
      successMessage: "Lead atualizado.",
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label="Ações">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {lead.status === "novo" && (
          <DropdownMenuItem onClick={() => move("em_negociacao")}>
            <Handshake className="size-4" />
            Iniciar negociação
          </DropdownMenuItem>
        )}
        {lead.status === "em_negociacao" && (
          <DropdownMenuItem onClick={() => move("novo")}>
            <RotateCcw className="size-4" />
            Voltar para novo
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onClose}>
          <Trophy className="size-4" />
          Fechar venda…
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onLose}>
          <XCircle className="size-4" />
          Marcar como perdido…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLead,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Novo lead</DialogTitle>
          <DialogDescription>
            Cadastre a barbearia que você está abordando.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nl-contato">Nome do contato</Label>
              <Input id="nl-contato" name="nome_contato" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-barbearia">Barbearia</Label>
              <Input id="nl-barbearia" name="barbearia" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-whatsapp">WhatsApp</Label>
              <Input id="nl-whatsapp" name="whatsapp" inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-cidade">Cidade</Label>
              <Input id="nl-cidade" name="cidade" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nl-notas">Observações</Label>
            <Textarea id="nl-notas" name="notas" rows={3} />
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Salvar lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LoseLeadDialog({
  lead,
  onOpenChange,
}: {
  lead: Lead | null;
  onOpenChange: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const { isPending: pending, executeAction } = useServerAction();

  function submit() {
    if (!lead) return;
    executeAction(() => updateLeadStatus(lead.id, "perdido", motivo), {
      successMessage: "Lead marcado como perdido.",
      onSuccess: () => {
        setMotivo("");
        onOpenChange();
      },
    });
  }

  return (
    <Dialog open={Boolean(lead)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Marcar como perdido</DialogTitle>
          <DialogDescription>
            {lead?.barbearia} — informe brevemente o motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ll-motivo">Motivo da perda</Label>
            <Input
              id="ll-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: achou caro, fechou com concorrente…"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={pending || motivo.trim().length < 3}
            onClick={submit}
          >
            {pending ? "Salvando..." : "Confirmar perda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseLeadDialog({
  lead,
  onOpenChange,
}: {
  lead: Lead | null;
  onOpenChange: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    closeLead,
    null
  );
  const [temSetup, setTemSetup] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onOpenChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (lead) setTemSetup(false);
  }, [lead]);

  if (!lead) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Fechar venda 🎉</DialogTitle>
          <DialogDescription>
            Dados do fechamento de {lead.barbearia}. Os percentuais de comissão
            são definidos aqui e não mudam depois.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="lead_id" value={lead.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cl-barbearia">Nome da barbearia</Label>
              <Input
                id="cl-barbearia"
                name="barbearia"
                defaultValue={lead.barbearia}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-cidade">Cidade</Label>
              <Input id="cl-cidade" name="cidade" defaultValue={lead.cidade ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-mensalidade">Mensalidade acordada</Label>
              <MoneyInput id="cl-mensalidade" name="mensalidade_cents" required />
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Select name="dia_vencimento" required defaultValue="5">
                <SelectTrigger>
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Dia {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Venda com setup?</p>
                <p className="text-xs text-muted-foreground">
                  Com setup: 40% recorrente + comissão do setup. Sem setup: 30%
                  recorrente.
                </p>
              </div>
              <Switch checked={temSetup} onCheckedChange={setTemSetup} />
            </div>
            <input type="hidden" name="tem_setup" value={temSetup ? "on" : ""} />

            {temSetup && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="cl-setup">
                  Valor do setup (R$ 500,00 a R$ 2.000,00)
                </Label>
                <MoneyInput id="cl-setup" name="setup_cents" required />
                <p className="text-xs text-muted-foreground">
                  Até R$ 800,00 você recebe 20% do setup; acima disso, 30%.
                </p>
              </div>
            )}
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Fechando..." : "Confirmar fechamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
