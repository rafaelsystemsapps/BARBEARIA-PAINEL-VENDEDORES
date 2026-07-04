# Painel de Parceiros — Barbearias

Painel web (independente do sistema das barbearias) para o programa de vendedores
comissionados do SaaS. Vendedores cadastram leads, acompanham o funil e as
comissões e solicitam saques; o admin aprova vendedores, confirma pagamentos
recebidos via PIX e gerencia saques.

O dinheiro **não passa** pelo painel: clientes pagam direto na chave PIX do admin,
e o admin paga os vendedores por PIX manualmente. **Sem gateway de pagamento**
nesta fase (decisão de negócio). A confirmação de pagamento está isolada numa
única função (`confirm_payment`), pronta para no futuro ser acionada por um
webhook de gateway sem reescrever o resto.

## Stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Auth e-mail/senha, Postgres, RLS)
- Tailwind v4 + shadcn/ui
- Deploy: Vercel · Idioma: pt-BR · Moeda: BRL
- Valores monetários sempre em **centavos (integer)** — nunca float

## Rodar localmente (Windows)

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar `.env.local`** (já criado com URL e anon key). Falta apenas a
   `SUPABASE_SERVICE_ROLE_KEY` — pegue em
   *Supabase → Project Settings → API → service_role*:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   ← preencher
   CRON_SECRET=...                 ← já gerado
   ```

3. **Aplicar o schema no banco** (precisa da senha do banco):
   ```bash
   npx supabase link --project-ref kuqosjponpfthjotcahe
   npm run db:push
   ```

4. **Popular dados de teste:**
   ```bash
   npm run seed
   ```

5. **Subir o servidor** — dê duplo-clique em `iniciar-servidor.bat` ou:
   ```bash
   npm run dev
   ```
   Acesse http://localhost:3000

## Contas de teste (criadas pelo seed)

| Papel | E-mail | Senha |
|---|---|---|
| Admin | admin@2026gmail.com | `Admin@2026` |
| Pendente (Carlos) | carlos@parceiro.dev | `Vendedor@2026!` |

> Troque a senha do admin após o primeiro login.

## Regras de comissão (implementadas em `supabase/migrations`)

- **Setup** (uma vez, quando o admin confirma): R$ 500–800 → 20%; R$ 800,01–2.000 → 30%.
  Formulário bloqueia fora de R$ 500–2.000.
- **Recorrente** (todo mês pago, vitalícia): sem setup → 30%; com setup → 40%.
  Percentual é **congelado no fechamento** e gravado no cliente.
- Comissão só nasce quando o admin **confirma** o pagamento (`confirm_payment`).
  Cliente não pagou → comissão daquele mês não existe.

## Funil

`lead: novo → em_negociacao → fechado | perdido` → ao fechar nasce um
`cliente: aguardando_setup (se houver setup) → ativo → inadimplente → cancelado`.
Só o admin muda o cliente para ativo/inadimplente/cancelado.

## Ciclo mensal de cobranças

`generate_monthly_charges()` cria uma cobrança `aguardando` por cliente ativo por
competência. **Idempotente** (índice único parcial: rodar 2× não duplica). Roda:

- diariamente via Vercel Cron (`vercel.json` → `/api/cron/gerar-cobrancas`,
  protegida por `CRON_SECRET`);
- pelo botão **"Gerar cobranças do mês"** na tela admin de pagamentos.

## Testes

```bash
npm run build         # build de produção limpo
```

Os critérios de aceite do PRD (isolamento por RLS, percentuais de comissão
congelados no fechamento, faixas de setup, saldo/saque e idempotência da geração
de cobranças) são garantidos pelas policies e funções de negócio em
`supabase/migrations` e verificáveis pela UI. Critério 1 (gate de aprovação):
registre um vendedor e veja o bloqueio até a aprovação.

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure as env vars (as 4 do `.env.local`).
3. O cron diário já está declarado em `vercel.json`.

## Fase 2 (fora do escopo atual)

Gateway de pagamento (Asaas/Mercado Pago) com webhook confirmando pagamento
automaticamente — substituirá a confirmação manual acionando `confirm_payment`.
Também adiados: captura automática de leads por `?ref` e notificações
WhatsApp/e-mail.
