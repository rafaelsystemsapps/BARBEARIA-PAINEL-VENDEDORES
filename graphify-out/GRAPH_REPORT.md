# Graph Report - .  (2026-07-09)

## Corpus Check
- Corpus is ~31,443 words - fits in a single context window. You may not need a graph.

## Summary
- 455 nodes · 1322 edges · 25 communities (21 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.79)
- Token cost: 45,000 input · 5,331 output

## Community Hubs (Navigation)
- Admin/Gestor Panels & Dialogs
- App Pages & Routing
- NPM Dependencies
- shadcn UI Components
- Route Loading Skeletons
- Seller Pages & Types
- shadcn Config
- Admin Server Actions
- Admin Data Tables
- TypeScript Config
- Layouts, Nav & Auth Guards
- Gestor/Commission Domain
- Seller Server Actions
- Project Docs & Stack
- Refactor Handoff Concepts
- Settings Config
- Middleware & Session
- DB Seed
- Vendedores Page
- ESLint Config
- Next Config
- PostCSS Config
- Vercel Cron Config

## God Nodes (most connected - your core abstractions)
1. `cn()` - 74 edges
2. `createClient()` - 55 edges
3. `formatBRL()` - 33 edges
4. `Button()` - 20 edges
5. `requireAdmin()` - 20 edges
6. `requireSeller()` - 16 edges
7. `compilerOptions` - 16 edges
8. `StatusBadge()` - 15 edges
9. `TableHeader()` - 15 edges
10. `TableBody()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Commission Snapshot at Lead Close` --semantically_similar_to--> `Commission Rules (setup and recurring)`  [INFERRED] [semantically similar]
  docs/prds/PATCH-gestor-handoff.md → README.md
- `EmptyState component extraction` --semantically_similar_to--> `frontend-design skill`  [INFERRED] [semantically similar]
  docs/prds/PRD-refatoracao-limpeza-v1.0.md → SKILL.md
- `Gestor Override Commission Model` --implements--> `RLS Policies and Business Functions`  [INFERRED]
  docs/prds/PATCH-gestor-handoff.md → README.md
- `loading.tsx per-route skeleton streaming` --conceptually_related_to--> `Next.js Version Breaking Changes Rule`  [INFERRED]
  docs/prds/PRD-navegacao-fluida-v1.0.md → AGENTS.md
- `Stack: Next.js 16, Supabase, Tailwind v4, shadcn/ui` --conceptually_related_to--> `Next.js Version Breaking Changes Rule`  [INFERRED]
  README.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared UI Pattern Extractions** — docs_prds_prd_refatoracao_empty_state, docs_prds_prd_refatoracao_data_table_card, docs_prds_prd_refatoracao_use_server_action [EXTRACTED 1.00]
- **Commission and Payment Confirmation Pipeline** — readme_funil, readme_commission_rules, readme_confirm_payment, readme_generate_monthly_charges [INFERRED 0.85]
- **Gestor Override Commission Math Model** — docs_prds_patch_gestor_override, docs_prds_patch_gestor_snapshot, docs_prds_patch_gestor_teto_trigger, docs_prds_patch_gestor_join_team [EXTRACTED 1.00]

## Communities (25 total, 4 thin omitted)

### Community 0 - "Admin/Gestor Panels & Dialogs"
Cohesion: 0.10
Nodes (52): ClientLite, SellerLite, diasVencidos(), PagamentosClient(), PayDialog(), RefuseDialog(), metadata, ClientLite (+44 more)

### Community 1 - "App Pages & Routing"
Cohesion: 0.10
Nodes (40): ConfirmDialog(), AdminHomePage(), metadata, AguardandoAprovacaoPage(), metadata, GestorComissoesPage(), LoginPage(), RegistroPage() (+32 more)

### Community 2 - "NPM Dependencies"
Cohesion: 0.04
Nodes (42): dependencies, class-variance-authority, clsx, lucide-react, next, next-themes, qrcode.react, radix-ui (+34 more)

### Community 3 - "shadcn UI Components"
Cohesion: 0.08
Nodes (33): Badge(), badgeVariants, CardAction(), CardFooter(), DialogFooter(), DialogOverlay(), DropdownMenuCheckboxItem(), DropdownMenuLabel() (+25 more)

### Community 4 - "Route Loading Skeletons"
Cohesion: 0.13
Nodes (5): FormSkeleton(), HeaderSkeleton(), StatCardsSkeleton(), TableSkeleton(), Skeleton()

### Community 5 - "Seller Pages & Types"
Cohesion: 0.09
Nodes (22): SaquesClient(), CarteiraPage(), VendedorLayout(), LeadsPage(), metadata, metadata, PerfilPage(), SaquesPage() (+14 more)

### Community 6 - "shadcn Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "Admin Server Actions"
Cohesion: 0.18
Nodes (21): CreateGestorDialog(), EditOverrideDialog(), ApproveDialog(), approveSeller(), confirmPayment(), createGestor(), createGestorSchema, generateCharges() (+13 more)

### Community 8 - "Admin Data Tables"
Cohesion: 0.14
Nodes (15): ClientesClient(), ClientRow, ClientesPage(), metadata, GestoresClient(), GestoresPage(), metadata, PaymentRow (+7 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "Layouts, Nav & Auth Guards"
Cohesion: 0.19
Nodes (11): AdminLayout(), GestorLayout(), GestorHome(), Home(), ADMIN_NAV, GESTOR_NAV, NavItem, PanelShell() (+3 more)

### Community 11 - "Gestor/Commission Domain"
Cohesion: 0.21
Nodes (12): Patch: Camada de Gestor — Handoff, join_team(team_code) signup binding, Gestor Override Commission Model, Commission Snapshot at Lead Close, teto_comissao_pct ceiling trigger, Commission Rules (setup and recurring), confirm_payment function, Sales Funnel (lead to cliente lifecycle) (+4 more)

### Community 12 - "Seller Server Actions"
Cohesion: 0.20
Nodes (9): CloseLeadDialog(), NewLeadDialog(), closeLead(), closeSchema, createLead(), leadSchema, profileSchema, updateLeadStatus() (+1 more)

### Community 13 - "Project Docs & Stack"
Cohesion: 0.29
Nodes (7): Next.js Version Breaking Changes Rule, Project CLAUDE.md (imports AGENTS.md), loading.tsx per-route skeleton streaming, Skeleton UI primitive (animate-pulse), PRD — Navegação Fluida entre Abas v1.0, Painel de Parceiros — Barbearias, Stack: Next.js 16, Supabase, Tailwind v4, shadcn/ui

### Community 14 - "Refactor Handoff Concepts"
Cohesion: 0.33
Nodes (7): Handoff ativo (Gemini refactor), Território Proibido (exclusive Claude Code files), DataTableCard wrapper extraction, EmptyState component extraction, PRD — Refatoração e Limpeza de Código v1.0, useServerAction hook (transition + toast), frontend-design skill

### Community 15 - "Settings Config"
Cohesion: 0.33
Nodes (5): ConfigForm(), ConfigPage(), metadata, saveSettings(), Setting

### Community 16 - "Middleware & Session"
Cohesion: 0.53
Nodes (4): PUBLIC_PATHS, updateSession(), config, proxy()

### Community 17 - "DB Seed"
Cohesion: 0.70
Nodes (4): createUser(), db, fail(), main()

### Community 18 - "Vendedores Page"
Cohesion: 0.50
Nodes (3): metadata, VendedoresPage(), VendedoresClient()

## Knowledge Gaps
- **143 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `shadcn UI Components` to `Admin/Gestor Panels & Dialogs`, `App Pages & Routing`, `Layouts, Nav & Auth Guards`, `Route Loading Skeletons`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Admin Server Actions` to `Admin/Gestor Panels & Dialogs`, `App Pages & Routing`, `Seller Pages & Types`, `Admin Data Tables`, `Layouts, Nav & Auth Guards`, `Seller Server Actions`, `Settings Config`, `Vendedores Page`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `Card()` connect `App Pages & Routing` to `Admin/Gestor Panels & Dialogs`, `shadcn UI Components`, `Route Loading Skeletons`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin/Gestor Panels & Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.10379746835443038 - nodes in this community are weakly interconnected._
- **Should `App Pages & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.09740259740259741 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._