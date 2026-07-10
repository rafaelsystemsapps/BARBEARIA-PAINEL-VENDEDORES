// Tipos espelhando o schema do banco (supabase/migrations).
// Valores monetários sempre em centavos (number inteiro).

export type Role = "admin" | "gestor" | "seller";
export type ProfileStatus = "pendente" | "ativo" | "pausado";
export type EntryOrigem = "venda_propria" | "override_time";
export type LeadStatus = "novo" | "em_negociacao" | "fechado" | "perdido";
export type ClientStatus =
  | "aguardando_setup"
  | "aguardando_pagamento"
  | "ativo"
  | "inadimplente"
  | "cancelado";
export type PaymentTipo = "setup" | "mensalidade";
export type PaymentStatus = "aguardando" | "confirmado" | "cancelado";
export type EntryStatus = "disponivel" | "sacada" | "estornada";
export type WithdrawalStatus = "solicitado" | "pago" | "recusado";

export interface Profile {
  id: string;
  role: Role;
  nome: string;
  email: string;
  whatsapp: string | null;
  pix_key: string | null;
  pix_name: string | null;
  ref_code: string | null;
  status: ProfileStatus;
  // Camada de gestor (times)
  gestor_id: string | null;
  team_code: string | null;
  override_recorrente_pct: number;
  override_setup_pct: number;
  bonus_time_pct: number;
  bonus_time_setup_pct: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  seller_id: string;
  nome_contato: string;
  barbearia: string;
  whatsapp: string | null;
  cidade: string | null;
  status: LeadStatus;
  motivo_perda: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  lead_id: string;
  seller_id: string;
  barbearia: string;
  cidade: string | null;
  mensalidade_cents: number;
  dia_vencimento: number;
  tem_setup: boolean;
  setup_cents: number | null;
  pct_recorrente: number;
  pct_setup: number | null;
  gestor_id: string | null;
  pct_gestor_recorrente: number | null;
  pct_gestor_setup: number | null;
  status: ClientStatus;
  closed_at: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  tipo: PaymentTipo;
  competencia: string;
  vencimento: string;
  valor_esperado_cents: number;
  valor_pago_cents: number | null;
  status: PaymentStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
}

export interface CommissionEntry {
  id: string;
  seller_id: string;
  client_id: string;
  payment_id: string | null;
  tipo: PaymentTipo;
  competencia: string;
  valor_cents: number;
  origem: EntryOrigem;
  status: EntryStatus;
  withdrawal_id: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  seller_id: string;
  valor_cents: number;
  pix_key: string;
  pix_name: string;
  status: WithdrawalStatus;
  motivo_recusa: string | null;
  requested_at: string;
  paid_at: string | null;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}
