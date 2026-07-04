import { redirect } from "next/navigation";
import { Hourglass, PauseCircle } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Aguardando aprovação" };

export default async function AguardandoAprovacaoPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "ativo") redirect("/");

  const pausado = profile.status === "pausado";

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          {pausado ? (
            <PauseCircle className="size-8" />
          ) : (
            <Hourglass className="size-8" />
          )}
        </span>

        <h1 className="mt-6 font-heading text-2xl font-semibold tracking-tight">
          {pausado ? "Conta pausada" : "Cadastro em análise"}
        </h1>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {pausado
            ? "Sua conta de parceiro está pausada no momento. Fale com o administrador do programa para reativá-la."
            : `Olá, ${profile.nome || "parceiro"}! Recebemos seu cadastro. O administrador vai revisar e liberar seu acesso — você será avisado pelo WhatsApp informado.`}
        </p>

        <form action={signOut} className="mt-8">
          <Button variant="outline" type="submit">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
