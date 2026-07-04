"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment", {
    p_payment_id: paymentId,
    p_valor_pago_cents: valor,
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
