"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Scissors } from "lucide-react";
import { signIn } from "@/lib/actions/auth";
import { AuthHero } from "@/components/auth-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthHero />

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scissors className="size-5" strokeWidth={2.2} />
            </span>
            <span className="font-heading text-lg font-semibold">
              Painel de Parceiros
            </span>
          </div>

          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Entrar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse com o e-mail e a senha do seu cadastro.
          </p>

          <form action={formAction} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Quer ser parceiro?{" "}
            <Link href="/registro" className="text-primary hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
