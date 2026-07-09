# Patch: Camada de Gestor — Handoff

Patch que adiciona o papel **gestor** (times de vendedores com comissão de override) ao painel existente, sem quebrar nada do que já funciona. Validado: sintaxe SQL conferida pelo parser oficial do PostgreSQL, `tsc --noEmit` limpo, ESLint limpo, e a matemática das comissões testada (fecha em 100%, sem centavo fantasma).

## Como aplicar

Na raiz do repositório (`BARBEARIA-PAINEL-VENDEDORES`):

```bash
git checkout -b feat/gestor
git apply --check gestor.patch   # confere se aplica limpo
git apply gestor.patch           # aplica
npm install
npx supabase db push             # roda a migration nova no Supabase
npm run dev                      # testar local
```

Se `git apply` reclamar de contexto (por diferença de fim de linha), use:
`git apply --3way gestor.patch` ou `patch -p1 < gestor.patch`.

## O que muda (15 arquivos)

**Banco (1 migration nova, nada destrutivo):**
`supabase/migrations/20260708120001_gestor.sql`
- Novo valor `gestor` no enum de papéis; novo enum `entry_origem` (venda_propria | override_time).
- `profiles` ganha: `gestor_id`, `team_code` (único), `override_recorrente_pct`, `override_setup_pct`, `bonus_time_pct`, `bonus_time_setup_pct`, com constraint garantindo bônus ≤ override.
- `clients` ganha o **snapshot** do gestor no fechamento: `gestor_id`, `pct_gestor_recorrente`, `pct_gestor_setup`. Trigger `clients_check_ceiling` impede que seller+gestor passe do teto (settings `teto_comissao_pct`, padrão 60).
- `commission_entries` ganha `origem` (com default `venda_propria`, então linhas antigas continuam válidas).
- `close_lead()` reescrita: grava o snapshot do gestor e aplica a bonificação (o gestor cede pontos do próprio override; a soma seller+gestor não muda).
- `confirm_payment()` reescrita: na **mesma transação**, gera a entry do seller E, se houver gestor no snapshot, a entry do override. Arredondamento por `floor` — a sobra de centavos fica com o admin, então nada estoura.
- RLS: gestor lê (nunca escreve) leads/clients/payments do próprio time e as próprias comissões/saques. Saque e saldo passam a aceitar gestor.
- `join_team(team_code)`: vincula o seller ao gestor no cadastro. Código inválido → erro sem impedir o cadastro.

**Aplicação:**
- `types.ts`: papel `gestor`, `EntryOrigem`, campos novos em `Profile`/`Client`/`CommissionEntry`.
- `auth.ts` (actions): campo opcional "Código do time" no signup, chamando `join_team`.
- `auth.ts` (lib): `requireGestor()`; `requireSeller` agora manda gestor para `/gestor`.
- `page.tsx` (raiz): roteia gestor → `/gestor`.
- `registro/page.tsx`: campo opcional de código do time no formulário.
- **Área do gestor** (`/gestor`): dashboard do time, extrato de overrides.
- **Admin**: nova tela `/admin/gestores` (criar gestor, definir team_code e override, pausar); em `/admin/vendedores`, vincular/transferir seller de time. Actions correspondentes em `actions/admin.ts`.
- `panel-shell.tsx`: navegação do novo perfil gestor.

## Regras de negócio travadas (não podem quebrar)

1. Seller **sempre** recebe no mínimo o piso (30/40 recorrente, 20/30 setup). Ter gestor nunca reduz a comissão dele.
2. Override do gestor é pago **por fora**, sobre o mesmo valor pago pelo cliente — nunca descontado do seller.
3. Bonificação = gestor cede pontos do **próprio** override ao time. `seller + gestor` permanece constante = piso + override. O custo total da operação (a sua parte) não muda por ação do gestor.
4. Snapshot no fechamento: mudar %, time ou bônus depois **não** afeta clientes já fechados.
5. Mesmo gatilho de sempre: comissão (do seller e do gestor) só nasce quando **você confirma o pagamento**. Cliente não pagou = ninguém ganha.
6. Teto configurável (`teto_comissao_pct`) validado por trigger no banco, não só na aplicação.

## Prova da matemática (mensalidade R$ 120, override 10%)

| Cenário | Seller | Gestor | Você (admin) | Total |
|---|---|---|---|---|
| Sem gestor | R$ 36,00 (30%) | — | R$ 84,00 | R$ 120,00 |
| Time, sem bônus | R$ 36,00 (30%) | R$ 12,00 (10%) | R$ 72,00 | R$ 120,00 |
| Time, bônus 3pts | R$ 39,60 (33%) | R$ 8,40 (7%) | R$ 72,00 | R$ 120,00 |

Sua parte (R$ 72,00) é idêntica com ou sem bônus — o gestor só redistribui dentro da fatia dele. Em valores quebrados (ex.: R$ 99,99), o `floor` joga a sobra de centavo para o admin, e a soma continua exata.

## Para testar depois de aplicar

1. Admin cria um gestor em `/admin/gestores` com `team_code` (ex.: TIMECARLOS) e override 10/5.
2. Um seller se cadastra informando TIMECARLOS → nasce vinculado (confirme em `/admin/vendedores`).
3. Aprove o seller, ele fecha uma venda de mensalidade R$ 120.
4. Em `/admin/pagamentos`, confirme o pagamento → o seller vê R$ 36 no extrato, o gestor vê R$ 12 em `/gestor/comissoes`.
5. Um seller sem código continua funcionando exatamente como antes (nenhuma entry de gestor é criada).

## Observação sobre o seed

O `scripts/seed.ts` atual cria só admin + 1 seller pendente e não foi alterado (para não mexer na guarda de idempotência). Para ter um gestor de teste pronto, crie-o pela tela `/admin/gestores` depois de aplicar — é o caminho real que você usará em produção mesmo.
