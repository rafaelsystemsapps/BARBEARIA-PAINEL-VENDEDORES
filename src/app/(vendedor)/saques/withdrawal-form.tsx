"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { requestWithdrawal } from "@/lib/actions/seller";
import type { ActionState } from "@/lib/actions/auth";
import { formatBRL } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WithdrawalForm({
  saldoCents,
  minimoCents,
  defaultPixKey,
  defaultPixName,
}: {
  saldoCents: number;
  minimoCents: number;
  defaultPixKey: string;
  defaultPixName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestWithdrawal,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  const semSaldo = saldoCents < minimoCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Solicitar saque</CardTitle>
        <CardDescription>
          {semSaldo
            ? `Você precisa de pelo menos ${formatBRL(minimoCents)} de saldo.`
            : "Informe o valor e a chave PIX de destino."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wd-valor">Valor</Label>
            <MoneyInput id="wd-valor" name="valor_cents" required disabled={semSaldo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wd-pix-name">Nome completo do titular</Label>
            <Input
              id="wd-pix-name"
              name="pix_name"
              defaultValue={defaultPixName}
              disabled={semSaldo}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wd-pix-key">Chave PIX</Label>
            <Input
              id="wd-pix-key"
              name="pix_key"
              defaultValue={defaultPixKey}
              placeholder="CPF, e-mail, telefone ou aleatória"
              disabled={semSaldo}
              required
            />
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending || semSaldo}>
            {pending ? "Enviando..." : "Solicitar saque"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
