"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

const leadSchema = z.object({
  nome_contato: z.string().trim().min(2, "Informe o nome do contato."),
  barbearia: z.string().trim().min(2, "Informe o nome da barbearia."),
  whatsapp: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export async function createLead(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = leadSchema.safeParse({
    nome_contato: formData.get("nome_contato"),
    barbearia: formData.get("barbearia"),
    whatsapp: formData.get("whatsapp"),
    cidade: formData.get("cidade"),
    notas: formData.get("notas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.from("leads").insert({
    seller_id: user.id,
    nome_contato: parsed.data.nome_contato,
    barbearia: parsed.data.barbearia,
    whatsapp: parsed.data.whatsapp || null,
    cidade: parsed.data.cidade || null,
    notas: parsed.data.notas || null,
    status: "novo",
  });
  if (error) return { error: `Não foi possível salvar o lead: ${error.message}` };

  revalidatePath("/leads");
  return { success: "Lead cadastrado!" };
}

export async function updateLeadStatus(
  leadId: string,
  status: "novo" | "em_negociacao" | "perdido",
  motivoPerda?: string
): Promise<ActionState> {
  if (status === "perdido" && !motivoPerda?.trim()) {
    return { error: "Informe o motivo da perda." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      status,
      motivo_perda: status === "perdido" ? motivoPerda!.trim() : null,
    })
    .eq("id", leadId);

  if (error) return { error: `Não foi possível atualizar: ${error.message}` };

  revalidatePath("/leads");
  return { success: "Lead atualizado." };
}

const closeSchema = z.object({
  lead_id: z.string().uuid(),
  barbearia: z.string().trim().min(2, "Informe o nome da barbearia."),
  cidade: z.string().trim().optional(),
  mensalidade_cents: z.coerce
    .number()
    .int()
    .positive("Informe o valor da mensalidade."),
  dia_vencimento: z.coerce
    .number()
    .int()
    .min(1, "Dia de vencimento entre 1 e 28.")
    .max(28, "Dia de vencimento entre 1 e 28."),
  tem_setup: z.coerce.boolean(),
  setup_cents: z.coerce.number().int().optional(),
});

export async function closeLead(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = closeSchema.safeParse({
    lead_id: formData.get("lead_id"),
    barbearia: formData.get("barbearia"),
    cidade: formData.get("cidade"),
    mensalidade_cents: formData.get("mensalidade_cents"),
    dia_vencimento: formData.get("dia_vencimento"),
    tem_setup: formData.get("tem_setup") === "on",
    setup_cents: formData.get("setup_cents") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  if (d.tem_setup) {
    if (!d.setup_cents || d.setup_cents < 50000 || d.setup_cents > 200000) {
      return { error: "O setup deve estar entre R$ 500,00 e R$ 2.000,00." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_lead", {
    p_lead_id: d.lead_id,
    p_barbearia: d.barbearia,
    p_cidade: d.cidade || null,
    p_mensalidade_cents: d.mensalidade_cents,
    p_dia_vencimento: d.dia_vencimento,
    p_tem_setup: d.tem_setup,
    p_setup_cents: d.tem_setup ? d.setup_cents : null,
  });

  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath("/carteira");
  revalidatePath("/dashboard");
  return { success: "Venda fechada! O cliente entrou na sua carteira." };
}

const withdrawalSchema = z.object({
  valor_cents: z.coerce.number().int().positive("Informe o valor do saque."),
  pix_key: z.string().trim().min(3, "Informe a chave PIX."),
  pix_name: z.string().trim().min(3, "Informe o nome completo do titular."),
});

export async function requestWithdrawal(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = withdrawalSchema.safeParse({
    valor_cents: formData.get("valor_cents"),
    pix_key: formData.get("pix_key"),
    pix_name: formData.get("pix_name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_withdrawal", {
    p_valor_cents: parsed.data.valor_cents,
    p_pix_key: parsed.data.pix_key,
    p_pix_name: parsed.data.pix_name,
  });

  if (error) return { error: error.message };

  revalidatePath("/saques");
  revalidatePath("/dashboard");
  return { success: "Saque solicitado! Você receberá na chave PIX informada." };
}

const profileSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo."),
  whatsapp: z.string().trim().min(10, "Informe o WhatsApp com DDD."),
  pix_key: z.string().trim().optional(),
  pix_name: z.string().trim().optional(),
});

export async function updateProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    nome: formData.get("nome"),
    whatsapp: formData.get("whatsapp"),
    pix_key: formData.get("pix_key"),
    pix_name: formData.get("pix_name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("profiles")
    .update({
      nome: parsed.data.nome,
      whatsapp: parsed.data.whatsapp,
      pix_key: parsed.data.pix_key || null,
      pix_name: parsed.data.pix_name || null,
    })
    .eq("id", user.id);

  if (error) return { error: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/perfil");
  return { success: "Perfil atualizado." };
}
