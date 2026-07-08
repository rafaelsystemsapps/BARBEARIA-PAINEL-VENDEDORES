# PRD/PATCH — refatoração e limpeza de código · v1.0

⚙️ EXECUÇÃO
Ferramenta:            Gemini Pro High (Antigravity)
Modelo recomendado:    Sonnet (refactor padrão, não é mecânico puro nem arquitetural)
Motivo (1 linha):      Extrair componentes/hooks repetidos exige julgamento de API (props, nomes) — mais que busca/substituição simples, mas não envolve banco/segurança
Custo estimado:        médio (toca ~9 arquivos, sem lógica de negócio nova)

## Contexto

Auditoria rápida do código atual (`src/`) mostrou:

- Sem `console.log`/`TODO`/`any` soltos — o código já está tipado e limpo nesse nível.
- **Duplicação de padrões de UI** repetida em 9 arquivos client (`*-client.tsx` em admin/vendedor + algumas `page.tsx`):
  1. Bloco de "estado vazio" (`rounded-lg border border-dashed p-10 text-center` + mensagem) — repetido em `saques-client.tsx`, `pagamentos-client.tsx`, `clientes-client.tsx`, `vendedores-client.tsx`, `leads-client.tsx`, e páginas do vendedor (`saques`, `comissoes`, `carteira`).
  2. Wrapper de tabela (`overflow-x-auto rounded-lg border` + `<Table>`) — repetido nos mesmos arquivos.
  3. Padrão de ação de servidor com toast: `useTransition` + `startTransition(async () => { const res = await action(...); if (res?.error) toast.error(...); else { toast.success(...); ... } })` — repetido em `PayDialog`/`RefuseDialog` (`saques-client.tsx`), `pagamentos-client.tsx`, `leads-client.tsx`.
- `public/*.svg` (file, globe, next, vercel, window) são o boilerplate padrão do `create-next-app` — confirmado via grep que nenhum é referenciado em `src/`. Candidatos a remoção.
- Tamanho dos maiores arquivos: `leads-client.tsx` (456 linhas), `saques-client.tsx` (269), `pagamentos-client.tsx` (264), `vendedores-client.tsx` (256), `clientes-client.tsx` (198) — todos client components de admin/vendedor com os padrões acima.

Arquivos de referência para os padrões existentes (não são exemplos de bug, são o "antes" da refatoração):
- `src/app/admin/saques/saques-client.tsx`
- `src/app/admin/pagamentos/pagamentos-client.tsx`
- `src/app/(vendedor)/leads/leads-client.tsx`
- `src/app/admin/clientes/clientes-client.tsx`
- `src/app/admin/vendedores/vendedores-client.tsx`

Componentes/utilitários já existentes que devem ser reaproveitados, não recriados:
- `src/components/status-badge.tsx`, `src/components/copy-button.tsx`, `src/components/money-input.tsx`
- `src/lib/format.ts` (formatBRL, formatDate, etc.)
- `src/components/ui/*` (shadcn — Table, Card, Dialog, Button etc.)

## Objetivo

Extrair os 3 padrões repetidos (estado vazio, wrapper de tabela, ação de servidor com toast) em componentes/hook compartilhados reutilizáveis, remover os SVGs de boilerplate não usados, e deixar o código mais enxuto e consistente — **sem alterar nenhum comportamento visível, rota, texto de UI ou lógica de negócio.**

## ⚠️ Regras obrigatórias

- **Refactor puro — zero mudança de comportamento.** Mesma UI, mesmos textos, mesmo fluxo. Se alguma extração exigir mudar comportamento, parar e reportar em vez de decidir sozinho.
- **Não tocar em (território exclusivo Claude Code):**
  - `src/lib/auth.ts`, `src/lib/actions/auth.ts`
  - `src/lib/supabase/**` (client.ts, server.ts, middleware.ts)
  - `src/lib/types.ts`
  - `supabase/**` (migrations, config.toml, full-schema.sql)
  - `.env`, `.env.example`
  - `src/proxy.ts`
- Pode tocar livremente em: `src/app/admin/**/*-client.tsx`, `src/app/(vendedor)/**/*.tsx`, `src/components/**` (exceto os arquivos listados acima), `public/*.svg` (remoção).
- Não renomear rotas, não mudar textos em português visíveis ao usuário.
- Não instalar novas dependências.
- Não refatorar nada fora do escopo acima (ex.: não mexer em `src/lib/actions/admin.ts` / `seller.ts` — a lógica de servidor não muda, só quem a chama no client).
- Rodar `git status` antes de começar e commitar com mensagem clara ao final (não abrir PR, não fazer push).

## O que fazer

**Fase 0 — Auditoria (reportar antes de codar):**
Confirmar a lista exata de arquivos que usam cada um dos 3 padrões (empty state, table wrapper, toast+transition) e listar quais props/variações existem entre eles (ex.: mensagens diferentes, ícones diferentes) para não perder nuance na extração.

**Fase 1 — Extrair `<EmptyState />`:**
Criar `src/components/empty-state.tsx` com props `message: string` (e opcionalmente `icon?`). Substituir os ~7 blocos duplicados por esse componente.

**Fase 2 — Extrair wrapper de tabela:**
Criar `src/components/data-table-card.tsx` (ou nome similar) que encapsula `<div className="overflow-x-auto rounded-lg border"><Table>...</Table></div>`. Substituir as duplicações, mantendo os `<TableHeader>`/`<TableBody>` como children.

**Fase 3 — Extrair hook de ação de servidor com toast:**
Criar `src/lib/hooks/use-server-action.ts` (ou local equivalente) que encapsula o padrão `useTransition` + chamar action + `toast.error`/`toast.success` + callback de sucesso. Substituir nos 3 arquivos que repetem esse bloco (`saques-client.tsx`, `pagamentos-client.tsx`, `leads-client.tsx`).

**Fase 4 — Remover boilerplate não usado:**
Apagar `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` (já confirmado sem referências em `src/`).

**Fase 5 — Passe de lint/format:**
Rodar `npm run lint` (ou equivalente do projeto) e corrigir apenas o que a extração introduziu. Não "arrumar" arquivos fora do escopo.

## Critério de pronto

- [ ] `npm run build` (ou `next build`) passa sem erros novos
- [ ] `npm run lint` limpo nos arquivos tocados
- [ ] Nenhuma mudança visível: mesmas telas, mesmos textos, mesmo comportamento de toasts/dialogs testado manualmente em pelo menos: Saques (pagar/recusar), Pagamentos (confirmar), Leads (criar/fechar/perder)
- [ ] Nenhum arquivo do território exclusivo (auth, supabase, types, migrations, .env) foi tocado — conferir com `git diff --stat`
- [ ] Commit único e claro ao final, sem push
