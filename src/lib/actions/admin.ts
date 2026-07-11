"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/gestores");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/saques");
}

// --- Vendedores ------------------------------------------------

const refCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]{2,19}$/,
    "Código deve ter 3–20 caracteres (letras minúsculas, números e hífen)."
  );

export async function approveSeller(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = String(formData.get("profile_id") ?? "");
  const parsed = refCodeSchema.safeParse(formData.get("ref_code"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status: "ativo", ref_code: parsed.data })
    .eq("id", profileId)
    .eq("role", "seller");

  if (error) {
    if (error.code === "23505") {
      return { error: "Este código já está em uso por outro vendedor." };
    }
    return { error: `Não foi possível aprovar: ${error.message}` };
  }

  revalidateAdmin();
  return { success: "Vendedor aprovado!" };
}

export async function setSellerStatus(
  profileId: string,
  status: "ativo" | "pausado"
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", profileId)
    .eq("role", "seller");

  if (error) return { error: error.message };

  revalidateAdmin();
  return { success: status === "pausado" ? "Vendedor pausado." : "Vendedor reativado." };
}

// --- Pagamentos ------------------------------------------------

export async function confirmPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const paymentId = String(formData.get("payment_id") ?? "");
  const valorRaw = parseInt(String(formData.get("valor_pago_cents") ?? "0"), 10);
  const valor = Number.isFinite(valorRaw) && valorRaw > 0 ? valorRaw : null;

  // Dia de vencimento: obrigatório ao confirmar mensalidade; o banco
  // valida. Enviado só quando o formulário o inclui (tipo mensalidade).
  const diaRaw = parseInt(String(formData.get("dia_vencimento") ?? ""), 10);
  const dia = Number.isFinite(diaRaw) && diaRaw >= 1 && diaRaw <= 31 ? diaRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment", {
    p_payment_id: paymentId,
    p_valor_pago_cents: valor,
    p_dia_vencimento: dia,
  });

  if (error) return { error: error.message };

  revalidateAdmin();
  return { success: "Pagamento confirmado — comissão gerada para o vendedor." };
}

export async function generateCharges(): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_charges");
  if (error) return { error: error.message };

  revalidateAdmin();
  return {
    success:
      Number(data) > 0
        ? `${data} cobrança(s) gerada(s) para a competência atual.`
        : "Nenhuma cobrança nova — todas já estavam geradas.",
  };
}

// --- Clientes --------------------------------------------------

export async function setClientStatus(
  clientId: string,
  status: "ativo" | "inadimplente" | "cancelado"
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidateAdmin();
  return { success: "Status do cliente atualizado." };
}

// --- Saques ----------------------------------------------------

export async function payWithdrawal(withdrawalId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_withdrawal", {
    p_withdrawal_id: withdrawalId,
  });
  if (error) return { error: error.message };

  revalidateAdmin();
  return { success: "Saque marcado como pago." };
}

export async function refuseWithdrawal(
  withdrawalId: string,
  motivo: string
): Promise<ActionState> {
  if (!motivo.trim()) return { error: "Informe o motivo da recusa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("refuse_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_motivo: motivo.trim(),
  });
  if (error) return { error: error.message };

  revalidateAdmin();
  return { success: "Saque recusado — o valor voltou ao saldo do vendedor." };
}

// --- Configurações ---------------------------------------------

const settingsSchema = z.object({
  demo_url: z
    .string()
    .trim()
    .url("Informe uma URL válida (https://...).")
    .or(z.literal("")),
  saque_minimo_cents: z.coerce.number().int().min(0),
  dias_alerta_inadimplencia: z.coerce.number().int().min(1).max(60),
  admin_pix_key: z.string().trim(),
});

export async function saveSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = settingsSchema.safeParse({
    demo_url: formData.get("demo_url"),
    saque_minimo_cents: formData.get("saque_minimo_cents"),
    dias_alerta_inadimplencia: formData.get("dias_alerta_inadimplencia"),
    admin_pix_key: formData.get("admin_pix_key"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const rows = [
    { key: "demo_url", value: parsed.data.demo_url },
    { key: "saque_minimo_cents", value: String(parsed.data.saque_minimo_cents) },
    {
      key: "dias_alerta_inadimplencia",
      value: String(parsed.data.dias_alerta_inadimplencia),
    },
    { key: "admin_pix_key", value: parsed.data.admin_pix_key },
  ];

  const { error } = await supabase.from("settings").upsert(rows);
  if (error) return { error: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/admin/config");
  revalidatePath("/dashboard");
  return { success: "Configurações salvas." };
}

// --- Gestores (times) ------------------------------------------

const teamCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9][A-Z0-9-]{2,19}$/,
    "Código do time deve ter 3–20 caracteres (letras, números e hífen)."
  );

const pctSchema = z.coerce.number().int().min(0).max(100);

const createGestorSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do gestor."),
  email: z.string().trim().email("E-mail inválido."),
  whatsapp: z.string().trim().optional(),
  team_code: teamCodeSchema,
  override_recorrente_pct: pctSchema,
  override_setup_pct: pctSchema,
  password: z.string().min(8, "A senha provisória precisa ter 8+ caracteres."),
});

/**
 * Cria um gestor. Usa a service role (admin) para criar o usuário já ativo
 * — gestor não passa pelo fluxo de aprovação de vendedor. Requer
 * SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.
 */
export async function createGestor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createGestorSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp"),
    team_code: formData.get("team_code"),
    override_recorrente_pct: formData.get("override_recorrente_pct"),
    override_setup_pct: formData.get("override_setup_pct"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return {
      error:
        "Configuração ausente: defina SUPABASE_SERVICE_ROLE_KEY no ambiente para criar gestores.",
    };
  }

  const { createClient: createAdminClient } = await import(
    "@supabase/supabase-js"
  );
  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { nome: d.nome, whatsapp: d.whatsapp ?? "" },
  });
  if (userErr) {
    return { error: `Não foi possível criar o gestor: ${userErr.message}` };
  }

  // O trigger cria o profile como seller/pendente; promovemos a gestor ativo.
  const { error: updErr } = await admin
    .from("profiles")
    .update({
      role: "gestor",
      status: "ativo",
      team_code: d.team_code,
      override_recorrente_pct: d.override_recorrente_pct,
      override_setup_pct: d.override_setup_pct,
    })
    .eq("id", created.user.id);

  if (updErr) {
    if (updErr.code === "23505") {
      return { error: "Este código de time já está em uso." };
    }
    return { error: `Gestor criado, mas falhou ao configurar: ${updErr.message}` };
  }

  revalidateAdmin();
  return {
    success: `Gestor ${d.nome} criado com o time ${d.team_code}.`,
  };
}

/** Atualiza os percentuais de override de um gestor. */
export async function updateGestorOverride(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const gestorId = String(formData.get("gestor_id") ?? "");
  const rec = pctSchema.safeParse(formData.get("override_recorrente_pct"));
  const setup = pctSchema.safeParse(formData.get("override_setup_pct"));
  if (!rec.success || !setup.success) {
    return { error: "Percentuais de override inválidos (0 a 100)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      override_recorrente_pct: rec.data,
      override_setup_pct: setup.data,
    })
    .eq("id", gestorId)
    .eq("role", "gestor");

  if (error) return { error: error.message };
  revalidateAdmin();
  return {
    success: "Override atualizado — vale para vendas futuras do time.",
  };
}

/** Pausa/reativa um gestor. */
export async function setGestorStatus(
  gestorId: string,
  status: "ativo" | "pausado"
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", gestorId)
    .eq("role", "gestor");

  if (error) return { error: error.message };
  revalidateAdmin();
  return { success: status === "pausado" ? "Gestor pausado." : "Gestor reativado." };
}

/**
 * Vincula, transfere ou desvincula um vendedor de um time.
 * gestorId vazio/null desvincula (torna o vendedor direto).
 */
export async function setSellerTeam(
  sellerId: string,
  gestorId: string | null
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ gestor_id: gestorId || null })
    .eq("id", sellerId)
    .eq("role", "seller");

  if (error) return { error: error.message };
  revalidateAdmin();
  return {
    success: gestorId
      ? "Vendedor vinculado ao time."
      : "Vendedor desvinculado (agora é vendedor direto).",
  };
}
