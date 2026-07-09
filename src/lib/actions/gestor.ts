"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

// Bonificação: o gestor cede pontos do PRÓPRIO override ao time.
// O banco (constraint profiles_override_valido + trigger
// protect_profile_columns) garante 0 ≤ bônus ≤ override e que só
// gestor altera. Aqui validamos só o formato de entrada.
const bonusSchema = z.object({
  bonus_time_pct: z.coerce
    .number()
    .int("Use um número inteiro.")
    .min(0, "O bônus não pode ser negativo.")
    .max(100, "Valor inválido."),
  bonus_time_setup_pct: z.coerce
    .number()
    .int("Use um número inteiro.")
    .min(0, "O bônus não pode ser negativo.")
    .max(100, "Valor inválido."),
});

export async function updateTeamBonus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = bonusSchema.safeParse({
    bonus_time_pct: formData.get("bonus_time_pct"),
    bonus_time_setup_pct: formData.get("bonus_time_setup_pct"),
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
      bonus_time_pct: parsed.data.bonus_time_pct,
      bonus_time_setup_pct: parsed.data.bonus_time_setup_pct,
    })
    .eq("id", user.id);

  if (error) {
    // A constraint do banco recusa bônus maior que o override.
    return {
      error:
        "Não foi possível salvar. O bônus não pode ser maior que o seu override.",
    };
  }

  revalidatePath("/gestor");
  return {
    success:
      "Bonificação atualizada! Vale para as próximas vendas do time.",
  };
}
