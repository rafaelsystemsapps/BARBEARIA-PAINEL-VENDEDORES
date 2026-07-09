"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string } | null;

export async function signIn(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }
  redirect("/");
}

const signUpSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.string().trim().email("E-mail inválido."),
  whatsapp: z.string().trim().min(10, "Informe o WhatsApp com DDD."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  team_code: z.string().trim().optional(),
});

export async function signUp(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp"),
    password: formData.get("password"),
    team_code: formData.get("team_code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { nome, email, whatsapp, password, team_code } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome, whatsapp } },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "Este e-mail já está cadastrado. Faça login." };
    }
    return { error: `Não foi possível concluir o cadastro: ${error.message}` };
  }

  // Se informou código de time e já há sessão, tenta vincular ao gestor.
  // Código inválido NÃO bloqueia o cadastro — apenas não vincula.
  if (data.session && team_code) {
    const { error: teamErr } = await supabase.rpc("join_team", {
      p_team_code: team_code,
    });
    if (teamErr) {
      return {
        error:
          "Cadastro criado, mas o código de time é inválido. Peça o código correto ao seu gestor — o administrador também pode vincular você depois. Faça login para continuar.",
      };
    }
  }

  // Sem confirmação de e-mail, o signUp já cria a sessão e o cadastro vai
  // direto para o gate de aprovação do administrador.
  if (data.session) redirect("/aguardando-aprovacao");

  // Fallback defensivo (só ocorre se a confirmação de e-mail for reativada
  // no projeto Supabase): mantém a mensagem focada na aprovação do admin.
  return {
    success:
      "Cadastro recebido! Aguarde a aprovação do administrador para acessar o painel.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
