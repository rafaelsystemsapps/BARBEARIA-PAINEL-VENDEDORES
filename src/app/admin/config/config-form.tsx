"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/auth";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfigForm({
  demoUrl,
  saqueMinimoCents,
  diasAlerta,
  adminPixKey,
}: {
  demoUrl: string;
  saqueMinimoCents: number;
  diasAlerta: number;
  adminPixKey: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveSettings,
    null
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="font-heading text-base">Parâmetros</CardTitle>
        <CardDescription>
          A chave PIX abaixo é exibida aos vendedores para repassarem aos clientes
          na cobrança.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-demo">URL da demonstração (Lovable)</Label>
            <Input
              id="cf-demo"
              name="demo_url"
              type="url"
              defaultValue={demoUrl}
              placeholder="https://seu-projeto.lovable.app"
            />
            <p className="text-xs text-muted-foreground">
              Cada vendedor recebe o link com o código dele: {"{URL}?ref={codigo}"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-minimo">Saque mínimo</Label>
              <MoneyInput
                id="cf-minimo"
                name="saque_minimo_cents"
                defaultCents={saqueMinimoCents}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-dias">Alerta de atraso (dias)</Label>
              <Input
                id="cf-dias"
                name="dias_alerta_inadimplencia"
                type="number"
                min={1}
                max={60}
                defaultValue={diasAlerta}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-pix">Minha chave PIX (recebimento das cobranças)</Label>
            <Input
              id="cf-pix"
              name="admin_pix_key"
              defaultValue={adminPixKey}
              placeholder="CPF, CNPJ, e-mail, telefone ou aleatória"
            />
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
