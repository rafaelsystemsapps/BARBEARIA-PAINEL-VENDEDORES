"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import type { Client } from "@/lib/types";
import { formatBRL, formatDate } from "@/lib/format";
import {
  whatsappLink,
  mensagemAVencer,
  mensagemVencida,
} from "@/lib/messages";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
import { Button } from "@/components/ui/button";
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

export type CarteiraRow = Client & {
  leads: { whatsapp: string | null; nome_contato: string | null } | null;
  vencimento_aberto: string | null;
};

// Janela de "prestes a vencer": 3 dias antes do vencimento.
const DIAS_ALERTA = 3;

type Filtro =
  | "todos"
  | "aguardando_pagamento"
  | "fechados"
  | "a_vencer"
  | "vencidos";

/** Dias até o vencimento (negativo = já venceu). */
function diasAte(vencimento: string | null): number | null {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const venc = new Date(`${vencimento}T12:00:00`);
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000);
}

/** Quanto o vendedor ganha com a mensalidade deste cliente. */
function ganhoMensal(c: CarteiraRow): number {
  return Math.floor((c.mensalidade_cents * (c.pct_recorrente ?? 0)) / 100);
}

export function CarteiraClient({
  clients,
  pixKey,
}: {
  clients: CarteiraRow[];
  pixKey: string | null;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const enriched = useMemo(
    () =>
      clients.map((c) => {
        const dias = diasAte(c.vencimento_aberto);
        const vencido = dias !== null && dias < 0;
        const aVencer = dias !== null && dias >= 0 && dias <= DIAS_ALERTA;
        return { ...c, dias, vencido, aVencer };
      }),
    [clients]
  );

  const filtered = useMemo(() => {
    switch (filtro) {
      case "aguardando_pagamento":
        return enriched.filter(
          (c) =>
            c.status === "aguardando_pagamento" ||
            c.status === "aguardando_setup"
        );
      case "fechados":
        return enriched.filter((c) => c.status === "ativo");
      case "a_vencer":
        return enriched.filter((c) => c.aVencer && c.status === "ativo");
      case "vencidos":
        return enriched.filter((c) => c.vencido);
      default:
        return enriched;
    }
  }, [enriched, filtro]);

  // Total que o vendedor ganha por mês com os clientes ativos.
  const ganhoTotal = enriched
    .filter((c) => c.status === "ativo")
    .reduce((s, c) => s + ganhoMensal(c), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Minha carteira
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clientes fechados por você. Comissão recorrente é vitalícia enquanto
            o cliente pagar.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-2">
          <p className="text-xs text-muted-foreground">Você ganha por mês</p>
          <p className="tabular font-heading text-lg font-semibold text-primary">
            {formatBRL(ganhoTotal)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos ({enriched.length})</SelectItem>
            <SelectItem value="aguardando_pagamento">
              Aguardando pagamento
            </SelectItem>
            <SelectItem value="fechados">Fechados (ativos)</SelectItem>
            <SelectItem value="a_vencer">Prestes a vencer</SelectItem>
            <SelectItem value="vencidos">Vencidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            clients.length === 0
              ? "Nenhum cliente na carteira ainda. Feche sua primeira venda na tela de Leads."
              : "Nenhum cliente neste filtro."
          }
        />
      ) : (
        <DataTableCard>
          <TableHeader>
            <TableRow>
              <TableHead>Barbearia</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mensalidade</TableHead>
              <TableHead className="text-right">Você ganha</TableHead>
              <TableHead className="hidden lg:table-cell">Vencimento</TableHead>
              <TableHead className="hidden lg:table-cell">Fechado em</TableHead>
              <TableHead className="text-right">Contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const ganho = ganhoMensal(c);
              const whatsapp = c.leads?.whatsapp ?? null;
              const msg = c.vencido
                ? mensagemVencida(c.barbearia, c.mensalidade_cents, pixKey)
                : mensagemAVencer(
                    c.barbearia,
                    c.mensalidade_cents,
                    c.dia_vencimento,
                    pixKey
                  );
              const link = whatsappLink(whatsapp, msg);

              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.barbearia}
                    <span className="block text-xs text-muted-foreground">
                      {c.cidade ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                    {c.vencido && (
                      <span className="mt-1 block text-xs font-medium text-destructive">
                        Venceu há {Math.abs(c.dias ?? 0)}d
                      </span>
                    )}
                    {c.aVencer && !c.vencido && (
                      <span className="mt-1 block text-xs font-medium text-amber-500">
                        Vence em {c.dias}d
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatBRL(c.mensalidade_cents)}
                    <span className="block text-xs text-muted-foreground">
                      {c.pct_recorrente}%
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right font-medium text-primary">
                    {formatBRL(ganho)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      por mês
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {c.dia_vencimento ? `Dia ${c.dia_vencimento}` : "A definir"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(c.closed_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {link ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="size-3.5" />
                          {c.vencido ? "Cobrar" : "Avisar"}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sem WhatsApp
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTableCard>
      )}
    </div>
  );
}
