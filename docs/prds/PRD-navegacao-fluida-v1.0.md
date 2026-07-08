# PRD/PATCH — navegação fluida entre abas · v1.0

⚙️ EXECUÇÃO
Ferramenta:            Claude Code (esta sessão)
Modelo recomendado:    Sonnet (já é o modelo atual — nada a trocar)
Motivo (1 linha):      implementação padrão e repetitiva (arquivo `loading.tsx` por rota), sem lógica de negócio nova
Custo estimado:        baixo

## Contexto
Projeto Next.js 16 (App Router) com `cacheComponents` **desabilitado** (`next.config.ts` sem a flag). Todo `page.tsx` do painel é `async` e busca dados do Supabase (dashboard, leads, carteira, comissões, saques, perfil, e as 7 rotas do admin). Nenhuma rota tem `loading.tsx`.

Conferido na doc interna do próprio Next instalado (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, seção "Dynamic routes without loading.tsx"): sem esse arquivo, rotas dinâmicas **não recebem prefetch parcial** e o clique no `<Link>` fica bloqueado esperando o servidor terminar de renderizar tudo — exatamente o sintoma relatado ("parece uma pedra").

`PanelShell` (sidebar) já fica montado entre navegações dentro do mesmo grupo de layout (`(vendedor)` / `admin`), então o skeleton só precisa cobrir a área de conteúdo — a sidebar continua clicável durante a transição.

Auditoria do repositório: `.gitignore` já cobre `.env*`, `.next/`, `*.tsbuildinfo`, `.vercel`; `git ls-files` não mostra nada indevido (sem secrets, sem build artifacts, sem `public/` com lixo). Nada a remover.

## Objetivo
Toda navegação entre abas do painel (vendedor e admin) mostra feedback visual instantâneo (skeleton) em vez de tela travada, usando o mecanismo nativo do Next (`loading.tsx` + streaming) — sem mudar dados, queries ou lógica de auth.

## ⚠️ Regras obrigatórias
- Investigar antes de alterar — feito (ver Contexto).
- Não tocar em: `src/lib/auth.ts`, `src/lib/actions/auth.ts`, `src/lib/supabase/**`, `src/proxy.ts`, `src/lib/types.ts`, `supabase/**`, `.env*`, `next.config.ts` (não vamos ligar `cacheComponents` — é mudança maior, fora de escopo).
- Não refatorar as queries existentes (já estão com `Promise.all` onde fazia sentido).
- Não remover as checagens `requireSeller()`/`requireAdmin()` duplicadas em cada `page.tsx` (existem além do layout como camada extra de segurança — revalidam papel/status a cada navegação; mexer nisso é decisão de segurança, fora de escopo deste patch).
- Nenhuma dependência nova.

## O que fazer
Fase 0 — Auditoria: concluída (este documento).

Fase 1 — Criar `src/components/ui/skeleton.tsx` (primitivo `animate-pulse` no padrão shadcn, usando tokens `bg-muted` já existentes no tema).

Fase 2 — Criar `loading.tsx` em cada rota com fetch de dados, usando skeletons simples (cards/linhas) que aproximam o layout real de cada tela:
- `src/app/(vendedor)/dashboard/loading.tsx`
- `src/app/(vendedor)/leads/loading.tsx`
- `src/app/(vendedor)/carteira/loading.tsx`
- `src/app/(vendedor)/comissoes/loading.tsx`
- `src/app/(vendedor)/saques/loading.tsx`
- `src/app/(vendedor)/perfil/loading.tsx`
- `src/app/admin/loading.tsx`
- `src/app/admin/vendedores/loading.tsx`
- `src/app/admin/vendedores/[id]/loading.tsx`
- `src/app/admin/pagamentos/loading.tsx`
- `src/app/admin/clientes/loading.tsx`
- `src/app/admin/saques/loading.tsx`
- `src/app/admin/config/loading.tsx`

Fase 3 — Rodar `npm run build` local para garantir que nada quebrou (rotas dinâmicas, tipos).

Fase 4 — Testar navegação manualmente (`npm run dev`), clicar entre abas do vendedor e do admin, confirmar que o skeleton aparece na hora do clique.

Fase 5 — Commit + push (autorizado pelo Mathias nesta conversa).

## Critério de pronto
- [ ] Todas as 13 rotas listadas têm `loading.tsx`
- [ ] `npm run build` passa sem erros/warnings novos
- [ ] Clique em qualquer aba do menu lateral mostra feedback visual imediato, sem travar
- [ ] Nenhum arquivo de auth/supabase/config tocado
- [ ] Nada além do escopo foi alterado
- [ ] Commit feito e push para o GitHub (deploy automático via Vercel)
