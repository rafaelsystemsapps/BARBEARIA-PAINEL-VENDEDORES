"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/actions/seller";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProfileForm({
  nome,
  email,
  whatsapp,
  pixKey,
  pixName,
  refCode,
}: {
  nome: string;
  email: string;
  whatsapp: string;
  pixKey: string;
  pixName: string;
  refCode: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProfile,
    null
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-heading text-base">
          Meus dados
          {refCode && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Código: {refCode}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pf-nome">Nome completo</Label>
            <Input id="pf-nome" name="nome" defaultValue={nome} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-email">E-mail</Label>
            <Input id="pf-email" value={email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-whatsapp">WhatsApp</Label>
            <Input
              id="pf-whatsapp"
              name="whatsapp"
              inputMode="tel"
              defaultValue={whatsapp}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pf-pix-name">Titular da chave PIX</Label>
              <Input id="pf-pix-name" name="pix_name" defaultValue={pixName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-pix-key">Chave PIX</Label>
              <Input id="pf-pix-key" name="pix_key" defaultValue={pixKey} />
            </div>
          </div>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
