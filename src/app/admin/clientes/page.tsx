import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient, type ClientRow } from "./clientes-client";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("*, profiles(nome)")
    .order("closed_at", { ascending: false });

  return <ClientesClient clients={(data ?? []) as unknown as ClientRow[]} />;
}
