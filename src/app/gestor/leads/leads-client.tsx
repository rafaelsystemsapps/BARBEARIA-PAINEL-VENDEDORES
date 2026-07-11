"use client";

import { useMemo, useState } from "react";
import type { Client } from "@/lib/types";
import { formatBRL, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableCard } from "@/components/data-table-card";
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

export type TeamRow = Client & {
  vendedor: string;
  vencimento_aberto: string | null;
};

type LeadAberto = {
  id: string;
  nome_contato: string;
  barbearia: string;
  cidade: string | null;
  status: string;
  vendedor: string;
};

const DIAS_ALERTA = 3;

type Filtro = "todos" | "em_negociacao" | "aguardando" | "ativos" | "atrasados";

function diasAte(vencimento: string | null): number | null {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const venc = new Date(`${vencimento}T12:00:00`);
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000);
}

export function GestorLeadsClient({
  clients,
  leadsAbertos,
}: {
  clients: TeamRow[];
  leadsAbertos: LeadAberto[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const enriched = useMemo(
    () =>
      clients.map((c) => {
        const dias = diasAte(c.vencimento_aberto);
        return {
          ...c,
          dias,
          vencido: dias !== null && dias < 0,
          aVencer: dias !== null && dias >= 0 && dias <= DIAS_ALERTA,
        };
      }),
    [clients]
  );

  const aguardando = enriched.filter(
    (c) =>
      c.status === "aguardando_pagamento" || c.status === "aguardando_setup"
  );
  const ativos = enriched.filter((c) => c.status === "ativo");
  const atrasados = enriched.filter(
    (c) => c.vencido || c.status === "inadimplente"
  );

  const showClients = filtro !== "em_negociacao";
  const filteredClients = useMemo(() => {
    switch (filtro) {
      case "aguardando":
        return aguardando;
      case "ativos":
        return ativos;
      case "atrasados":
        return atrasados;
      default:
        return enriched;
    }
  }, [filtro, enriched, aguardando, ativos, atrasados]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Leads do time
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe o funil e a saúde dos pagamentos dos clientes dos seus
          vendedores. Cliente atrasado = override que você deixa de receber.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Em negociação</p>
          <p className="tabular font-heading text-xl font-semibold">
            {leadsAbertos.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
          <p className="tabular font-heading text-xl font-semibold text-amber-500">
            {aguardando.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="tabular font-heading text-xl font-semibold text-primary">
            {ativos.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Atrasados</p>
          <p className="tabular font-heading text-xl font-semibold text-destructive">
            {atrasados.length}
          </p>
        </div>
      </div>

      <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Filtrar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os clientes</SelectItem>
          <SelectItem value="em_negociacao">Em negociação (leads)</SelectItem>
          <SelectItem value="aguardando">Aguardando pagamento</SelectItem>
          <SelectItem value="ativos">Fechados (ativos)</SelectItem>
          <SelectItem value="atrasados">Atrasados</SelectItem>
        </SelectContent>
      </Select>

      {!showClients ? (
        leadsAbertos.length === 0 ? (
          <EmptyState message="Nenhum lead em negociação no time." />
        ) : (
          <DataTableCard>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Barbearia</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsAbertos.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome_contato}</TableCell>
                  <TableCell>{l.barbearia}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.vendedor}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTableCard>
        )
      ) : filteredClients.length === 0 ? (
        <EmptyState message="Nenhum cliente neste filtro." />
      ) : (
        <DataTableCard>
          <TableHeader>
            <TableRow>
              <TableHead>Barbearia</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mensalidade</TableHead>
              <TableHead className="text-right">Seu override</TableHead>
              <TableHead className="hidden lg:table-cell">Fechado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.barbearia}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.vendedor}
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
                </TableCell>
                <TableCell className="tabular text-right font-medium text-primary">
                  {formatBRL(
                    Math.floor(
                      (c.mensalidade_cents * (c.pct_gestor_recorrente ?? 0)) / 100
                    )
                  )}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {c.pct_gestor_recorrente ?? 0}%
                  </span>
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
