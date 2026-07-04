import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SaquesClient, type WithdrawalRow } from "./saques-client";

export const metadata = { title: "Saques" };

export default async function AdminSaquesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("withdrawals")
    .select("*, profiles(nome, email, whatsapp)")
    .order("requested_at", { ascending: false });

  const rows = (data ?? []) as unknown as WithdrawalRow[];

  return (
    <SaquesClient
      pending={rows.filter((w) => w.status === "solicitado")}
      history={rows.filter((w) => w.status !== "solicitado")}
    />
  );
}
