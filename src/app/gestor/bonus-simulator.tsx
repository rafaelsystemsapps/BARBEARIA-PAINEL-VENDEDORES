"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { updateTeamBonus } from "@/lib/actions/gestor";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Piso do seller sem bônus: 30% (só mensalidade) — usado como base
// visual do exemplo. O override recorrente do gestor é o teto do bônus.
const PISO_RECORRENTE = 30;

export function BonusSimulator({
  overrideRecorrente,
  overrideSetup,
  bonusRecorrente,
  bonusSetup,
}: {
  overrideRecorrente: number;
  overrideSetup: number;
  bonusRecorrente: number;
  bonusSetup: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateTeamBonus,
    null
  );
  const [bonusRec, setBonusRec] = useState(bonusRecorrente);
  const [bonusSet, setBonusSet] = useState(bonusSetup);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  const sellerRec = PISO_RECORRENTE + bonusRec;
  const gestorRec = Math.max(overrideRecorrente - bonusRec, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <Sparkles className="size-4 text-primary" />
          Bonificação do time
        </CardTitle>
        <CardDescription>
          Ceda parte do seu override para incentivar o time. A soma nunca muda —
          você só redistribui a sua fatia. Vale para vendas futuras.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bonus-rec">Bônus recorrente</Label>
              <span className="tabular text-sm font-medium">
                {bonusRec}% de {overrideRecorrente}%
              </span>
            </div>
            <input
              id="bonus-rec"
              name="bonus_time_pct"
              type="range"
              min={0}
              max={overrideRecorrente}
              value={bonusRec}
              onChange={(e) => setBonusRec(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Time ganha</p>
                <p className="tabular font-heading text-lg font-semibold text-primary">
                  {sellerRec}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Você fica com</p>
                <p className="tabular font-heading text-lg font-semibold">
                  {gestorRec}%
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Exemplo em uma mensalidade só (piso do seller {PISO_RECORRENTE}%).
              Em vendas com setup, o seller parte de 40%.
            </p>
          </div>

          {overrideSetup > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bonus-set">Bônus de setup</Label>
                <span className="tabular text-sm font-medium">
                  {bonusSet}% de {overrideSetup}%
                </span>
              </div>
              <input
                id="bonus-set"
                name="bonus_time_setup_pct"
                type="range"
                min={0}
                max={overrideSetup}
                value={bonusSet}
                onChange={(e) => setBonusSet(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
          {overrideSetup === 0 && (
            <input type="hidden" name="bonus_time_setup_pct" value={0} />
          )}

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Salvando..." : "Salvar bonificação"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
