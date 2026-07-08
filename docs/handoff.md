# Handoff ativo

## Refatoração/limpeza de UI duplicada — Gemini Pro High
- **Quem faz:** Gemini Pro High (Antigravity)
- **PRD:** `docs/prds/PRD-refatoracao-limpeza-v1.0.md`
- **Escopo:** extrair `<EmptyState />`, wrapper de tabela e hook de server action+toast (duplicados em 9 arquivos `*-client.tsx`/`page.tsx` de admin e vendedor); remover SVGs boilerplate não usados em `public/`.
- **Território proibido para o Gemini:** `src/lib/auth.ts`, `src/lib/actions/auth.ts`, `src/lib/supabase/**`, `src/lib/types.ts`, `supabase/**`, `.env*`, `src/proxy.ts`.
- **Claude Code (eu):** não estou tocando em nenhum arquivo em paralelo agora — aguardando o Gemini terminar.
- **Antes de retomar:** rodar `git log -3` e `git status` para ver o que o Gemini commitou, e revisar o diff contra as regras do PRD antes de aceitar.
