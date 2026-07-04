"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Scissors, MailCheck } from "lucide-react";
import { signUp } from "@/lib/actions/auth";
import { AuthHero } from "@/components/auth-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState(signUp, null);

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

          {state?.success ? (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <MailCheck className="size-7" />
              </span>
              <h2 className="mt-4 font-heading text-2xl font-semibold">
                Cadastro recebido!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {state.success}
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/login">Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Quero ser parceiro
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Após o cadastro, seu acesso é liberado pelo administrador.
              </p>

              <form action={formAction} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input id="nome" name="nome" autoComplete="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    inputMode="tel"
                    placeholder="11 91234-5678"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                {state?.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Enviando..." : "Criar cadastro"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
