import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient, type ClientRow } from "./clientes-client";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*, profiles!clients_seller_id_fkey(nome)")
    .order("closed_at", { ascending: false });

  if (error) console.error("Erro ao carregar clientes:", error.message);

  return <ClientesClient clients={(data ?? []) as unknown as ClientRow[]} />;
}
