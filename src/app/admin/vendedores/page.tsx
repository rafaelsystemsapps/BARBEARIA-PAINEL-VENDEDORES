import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/types";
import { VendedoresClient } from "./vendedores-client";

export const metadata = { title: "Vendedores" };

export default async function VendedoresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [sellersRes, clientsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "seller")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, seller_id, status, mensalidade_cents"),
  ]);

  return (
    <VendedoresClient
      sellers={(sellersRes.data ?? []) as Profile[]}
      clients={
        (clientsRes.data ?? []) as Pick<
          Client,
          "id" | "seller_id" | "status" | "mensalidade_cents"
        >[]
      }
    />
  );
}
