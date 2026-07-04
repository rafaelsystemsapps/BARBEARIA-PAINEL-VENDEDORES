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
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada)." };
    }
    return { error: "E-mail ou senha inválidos." };
  }
  redirect("/");
}

const signUpSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.string().trim().email("E-mail inválido."),
  whatsapp: z.string().trim().min(10, "Informe o WhatsApp com DDD."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { nome, email, whatsapp, password } = parsed.data;
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

  // Sessão criada = confirmação de e-mail desativada no projeto
  if (data.session) redirect("/aguardando-aprovacao");

  return {
    success:
      "Cadastro recebido! Confirme seu e-mail e aguarde a aprovação do administrador para acessar o painel.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
