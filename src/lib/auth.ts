import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Garante vendedor aprovado; redireciona caso contrário. */
export async function requireSeller(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "gestor") redirect("/gestor");
  if (profile.status !== "ativo") redirect("/aguardando-aprovacao");
  return profile;
}

/** Garante gestor ativo; redireciona caso contrário. */
export async function requireGestor(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role !== "gestor") redirect("/");
  if (profile.status !== "ativo") redirect("/aguardando-aprovacao");
  return profile;
}

/** Garante admin ativo; redireciona caso contrário. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  if (profile.status !== "ativo") redirect("/aguardando-aprovacao");
  return profile;
}
