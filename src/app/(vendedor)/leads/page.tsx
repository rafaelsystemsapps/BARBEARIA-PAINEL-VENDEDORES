import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types";
import { LeadsClient } from "./leads-client";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  await requireSeller();
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false });

  return <LeadsClient leads={(data ?? []) as Lead[]} />;
}
