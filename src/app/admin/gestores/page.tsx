import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/types";
import { GestoresClient } from "./gestores-client";

export const metadata = { title: "Gestores" };

export default async function GestoresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [gestoresRes, sellersRes, clientsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "gestor")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, nome, email, gestor_id, status")
      .eq("role", "seller"),
    supabase.from("clients").select("id, seller_id, gestor_id, status, mensalidade_cents"),
  ]);

  return (
    <GestoresClient
      gestores={(gestoresRes.data ?? []) as Profile[]}
      sellers={
        (sellersRes.data ?? []) as Pick<
          Profile,
          "id" | "nome" | "email" | "gestor_id" | "status"
        >[]
      }
      clients={
        (clientsRes.data ?? []) as Pick<
          Client,
          "id" | "seller_id" | "gestor_id" | "status" | "mensalidade_cents"
        >[]
      }
    />
  );
}
