import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "warn" | "ok" | "bad" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  warn: "border-primary/40 bg-primary/10 text-primary",
  ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  bad: "border-red-400/30 bg-red-400/10 text-red-300",
  muted: "border-border bg-muted text-muted-foreground",
};

const LABELS: Record<string, { label: string; tone: Tone }> = {
  // leads
  novo: { label: "Novo", tone: "info" },
  em_negociacao: { label: "Em negociação", tone: "warn" },
  fechado: { label: "Fechado", tone: "ok" },
  perdido: { label: "Perdido", tone: "bad" },
  // clientes
  aguardando_setup: { label: "Aguardando setup", tone: "warn" },
  aguardando_pagamento: { label: "Aguardando pagamento", tone: "warn" },
  ativo: { label: "Ativo", tone: "ok" },
  inadimplente: { label: "Inadimplente", tone: "bad" },
  cancelado: { label: "Cancelado", tone: "muted" },
  // cobranças
  aguardando: { label: "Aguardando", tone: "warn" },
  confirmado: { label: "Confirmado", tone: "ok" },
  // comissões
  disponivel: { label: "Disponível", tone: "ok" },
  sacada: { label: "Sacada", tone: "muted" },
  estornada: { label: "Estornada", tone: "bad" },
  // saques
  solicitado: { label: "Solicitado", tone: "warn" },
  pago: { label: "Pago", tone: "ok" },
  recusado: { label: "Recusado", tone: "bad" },
  // perfis
  pendente: { label: "Pendente", tone: "warn" },
  pausado: { label: "Pausado", tone: "muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = LABELS[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge variant="outline" className={cn("font-normal", TONES[cfg.tone])}>
      {cfg.label}
    </Badge>
  );
}
