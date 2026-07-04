import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "ativo") redirect("/aguardando-aprovacao");
  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}
