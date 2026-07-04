import { Scissors } from "lucide-react";

/**
 * Painel lateral das telas públicas (login/registro): marca do
 * programa com listras diagonais de poste de barbeiro ao fundo.
 */
export function AuthHero() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-sidebar p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent 0 28px, var(--primary) 28px 34px, transparent 34px 62px, var(--foreground) 62px 68px)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Scissors className="size-6" strokeWidth={2.2} />
        </span>
        <span className="font-heading text-xl font-semibold tracking-tight">
          Painel de Parceiros
        </span>
      </div>

      <div className="relative max-w-md">
        <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">
          Venda o sistema.
          <br />
          <span className="text-primary">Receba todo mês.</span>
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Indique barbearias, acompanhe seu funil e receba comissão vitalícia
          sobre cada mensalidade paga — direto na sua chave PIX.
        </p>
      </div>

      <p className="relative text-xs text-muted-foreground">
        Programa de parceiros · Sistema para barbearias
      </p>
    </div>
  );
}
