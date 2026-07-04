/**
 * Seed de desenvolvimento.
 *
 * Uso: npm run seed   (lê .env.local; exige SUPABASE_SERVICE_ROLE_KEY)
 *
 * Cria: 1 admin, 2 vendedores ativos (João e Maria), 1 vendedor pendente
 * (Carlos) e dados em todos os estados: leads (novo/negociação/perdido/
 * fechado), clientes (aguardando_setup/ativo/inadimplente/cancelado),
 * pagamentos (aguardando/confirmado), comissões (disponível/sacada) e
 * saques (solicitado/pago). Usa as funções de negócio reais (close_lead,
 * confirm_payment, generate_monthly_charges, request_withdrawal...).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ADMIN_EMAIL = "rafael.systemsapps@gmail.com";
const ADMIN_PASSWORD = "Admin@2026!";
const SELLER_PASSWORD = "Vendedor@2026!";

if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(step: string, error: { message: string } | null): never {
  console.error(`✖ Falhou em: ${step}\n  ${error?.message ?? "erro desconhecido"}`);
  process.exit(1);
}

async function createUser(
  email: string,
  password: string,
  nome: string,
  whatsapp: string
): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, whatsapp },
  });
  if (error) fail(`criar usuário ${email}`, error);
  return data.user.id;
}

/** Competência (dia 1) deslocada N meses a partir do mês atual. */
function competencia(offsetMeses: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function vencimento(comp: string, dia: number): string {
  return `${comp.slice(0, 8)}${String(dia).padStart(2, "0")}`;
}

async function createLead(
  sellerId: string,
  lead: Record<string, unknown>
): Promise<string> {
  const { data, error } = await db
    .from("leads")
    .insert({ seller_id: sellerId, ...lead })
    .select("id")
    .single();
  if (error) fail(`criar lead ${lead.barbearia}`, error);
  return data.id;
}

async function closeLead(
  leadId: string,
  opts: {
    barbearia: string;
    cidade: string;
    mensalidade: number;
    dia: number;
    setup?: number;
  }
): Promise<string> {
  const { data, error } = await db.rpc("close_lead", {
    p_lead_id: leadId,
    p_barbearia: opts.barbearia,
    p_cidade: opts.cidade,
    p_mensalidade_cents: opts.mensalidade,
    p_dia_vencimento: opts.dia,
    p_tem_setup: Boolean(opts.setup),
    p_setup_cents: opts.setup ?? null,
  });
  if (error) fail(`fechar venda ${opts.barbearia}`, error);
  return data as string;
}

async function insertMensalidade(
  clientId: string,
  comp: string,
  dia: number,
  valor: number
): Promise<string> {
  const { data, error } = await db
    .from("payments")
    .insert({
      client_id: clientId,
      tipo: "mensalidade",
      competencia: comp,
      vencimento: vencimento(comp, dia),
      valor_esperado_cents: valor,
      status: "aguardando",
    })
    .select("id")
    .single();
  if (error) fail(`criar mensalidade ${comp}`, error);
  return data.id;
}

async function confirm(paymentId: string, valor?: number) {
  const { error } = await db.rpc("confirm_payment", {
    p_payment_id: paymentId,
    p_valor_pago_cents: valor ?? null,
  });
  if (error) fail(`confirmar pagamento ${paymentId}`, error);
}

async function setupPaymentId(clientId: string): Promise<string> {
  const { data, error } = await db
    .from("payments")
    .select("id")
    .eq("client_id", clientId)
    .eq("tipo", "setup")
    .single();
  if (error) fail("localizar pagamento de setup", error);
  return data.id;
}

async function main() {
  // Guarda de idempotência: não semear duas vezes
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();
  if (existing) {
    console.log("Seed já foi executado (admin existe). Nada a fazer.");
    console.log(`Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log(`Vendedores: joao@parceiro.dev e maria@parceiro.dev / ${SELLER_PASSWORD}`);
    return;
  }

  console.log("→ Criando usuários...");
  const adminId = await createUser(ADMIN_EMAIL, ADMIN_PASSWORD, "Rafael", "11 90000-0000");
  const joaoId = await createUser("joao@parceiro.dev", SELLER_PASSWORD, "João Ferreira", "11 91111-1111");
  const mariaId = await createUser("maria@parceiro.dev", SELLER_PASSWORD, "Maria Souza", "21 92222-2222");
  await createUser("carlos@parceiro.dev", SELLER_PASSWORD, "Carlos Lima", "31 93333-3333");

  console.log("→ Papéis e aprovações...");
  {
    const { error } = await db
      .from("profiles")
      .update({ role: "admin", status: "ativo" })
      .eq("id", adminId);
    if (error) fail("promover admin", error);
  }
  for (const [id, ref] of [
    [joaoId, "joao123"],
    [mariaId, "maria123"],
  ] as const) {
    const { error } = await db
      .from("profiles")
      .update({ status: "ativo", ref_code: ref })
      .eq("id", id);
    if (error) fail(`aprovar vendedor ${ref}`, error);
  }
  // Carlos permanece pendente (para testar o fluxo de aprovação)

  console.log("→ Configurações...");
  {
    const { error } = await db.from("settings").upsert([
      { key: "demo_url", value: "https://demo-barbearia.lovable.app" },
      { key: "saque_minimo_cents", value: "5000" },
      { key: "dias_alerta_inadimplencia", value: "7" },
      { key: "admin_pix_key", value: "troque-esta-chave-em-configuracoes" },
    ]);
    if (error) fail("salvar settings", error);
  }

  console.log("→ Leads do João (novo, negociação, perdido)...");
  await createLead(joaoId, {
    nome_contato: "Pedro Alves",
    barbearia: "Barba Norte",
    whatsapp: "11 94444-0001",
    cidade: "Guarulhos",
    status: "novo",
    notas: "Indicação de cliente. Chamar depois das 18h.",
  });
  await createLead(joaoId, {
    nome_contato: "Lucas Prado",
    barbearia: "Sr. Bigode",
    whatsapp: "11 94444-0002",
    cidade: "São Paulo",
    status: "em_negociacao",
    notas: "Pediu proposta com setup.",
  });
  await createLead(joaoId, {
    nome_contato: "Renan Dias",
    barbearia: "Corte Fino",
    whatsapp: "11 94444-0003",
    cidade: "Osasco",
    status: "perdido",
    motivo_perda: "Fechou com concorrente mais barato.",
  });

  console.log("→ Fechamentos do João (todos os cenários de comissão)...");
  // Sem setup -> 30% recorrente, nasce ativo
  const navalhaLead = await createLead(joaoId, {
    nome_contato: "Tiago Nunes",
    barbearia: "Navalha de Ouro",
    whatsapp: "11 94444-0004",
    cidade: "São Paulo",
    status: "em_negociacao",
  });
  const navalha = await closeLead(navalhaLead, {
    barbearia: "Navalha de Ouro",
    cidade: "São Paulo",
    mensalidade: 19990,
    dia: 5,
  });

  // Setup R$ 800,00 (limite da faixa de 20%) -> 40% rec + 20% setup
  const imperialLead = await createLead(joaoId, {
    nome_contato: "Bruno Reis",
    barbearia: "Barbearia Imperial",
    whatsapp: "11 94444-0005",
    cidade: "Campinas",
    status: "em_negociacao",
  });
  const imperial = await closeLead(imperialLead, {
    barbearia: "Barbearia Imperial",
    cidade: "Campinas",
    mensalidade: 24990,
    dia: 10,
    setup: 80000,
  });
  await confirm(await setupPaymentId(imperial)); // ativa o cliente + comissão 20%

  // Setup R$ 1.200,00 -> 30% do setup; depois vira inadimplente
  const domCorteLead = await createLead(joaoId, {
    nome_contato: "Felipe Braz",
    barbearia: "Dom Corte",
    whatsapp: "11 94444-0006",
    cidade: "Santos",
    status: "em_negociacao",
  });
  const domCorte = await closeLead(domCorteLead, {
    barbearia: "Dom Corte",
    cidade: "Santos",
    mensalidade: 29990,
    dia: 15,
    setup: 120000,
  });
  await confirm(await setupPaymentId(domCorte));
  // mensalidade do mês passado vencida e não paga -> inadimplente
  await insertMensalidade(domCorte, competencia(-1), 15, 29990);
  {
    const { error } = await db
      .from("clients")
      .update({ status: "inadimplente" })
      .eq("id", domCorte);
    if (error) fail("marcar Dom Corte inadimplente", error);
  }

  // Setup R$ 800,01 (primeiro centavo da faixa de 30%) — setup ainda aguardando
  const primeLead = await createLead(joaoId, {
    nome_contato: "Igor Matos",
    barbearia: "Barber Prime",
    whatsapp: "11 94444-0007",
    cidade: "São Bernardo",
    status: "em_negociacao",
  });
  await closeLead(primeLead, {
    barbearia: "Barber Prime",
    cidade: "São Bernardo",
    mensalidade: 27990,
    dia: 20,
    setup: 80001,
  });
  // (fica aguardando_setup: nenhuma comissão até o admin confirmar)

  console.log("→ Carteira da Maria (histórico de mensalidades + cancelado)...");
  const estiloLead = await createLead(mariaId, {
    nome_contato: "Rafa Torres",
    barbearia: "Estilo Clássico",
    whatsapp: "21 95555-0001",
    cidade: "Rio de Janeiro",
    status: "em_negociacao",
  });
  const estilo = await closeLead(estiloLead, {
    barbearia: "Estilo Clássico",
    cidade: "Rio de Janeiro",
    mensalidade: 14990,
    dia: 8,
  });
  // 3 meses de histórico pagos -> comissões de 30%
  for (const offset of [-3, -2, -1]) {
    const pid = await insertMensalidade(estilo, competencia(offset), 8, 14990);
    await confirm(pid);
  }

  const vilaLead = await createLead(mariaId, {
    nome_contato: "Nina Castro",
    barbearia: "Vila Barba",
    whatsapp: "21 95555-0002",
    cidade: "Niterói",
    status: "em_negociacao",
  });
  const vila = await closeLead(vilaLead, {
    barbearia: "Vila Barba",
    cidade: "Niterói",
    mensalidade: 9990,
    dia: 12,
  });
  {
    const { error } = await db
      .from("clients")
      .update({ status: "cancelado" })
      .eq("id", vila);
    if (error) fail("cancelar Vila Barba", error);
  }
  await createLead(mariaId, {
    nome_contato: "Otávio Luz",
    barbearia: "Machado & Tesoura",
    whatsapp: "21 95555-0003",
    cidade: "Rio de Janeiro",
    status: "novo",
  });

  console.log("→ Saques da Maria (pago + solicitado, via fluxo real)...");
  const mariaClient: SupabaseClient = createClient(URL!, ANON_KEY!, {
    auth: { persistSession: false },
  });
  {
    const { error } = await mariaClient.auth.signInWithPassword({
      email: "maria@parceiro.dev",
      password: SELLER_PASSWORD,
    });
    if (error) fail("login da Maria", error);
  }
  const { data: saque1, error: saqueErr } = await mariaClient.rpc(
    "request_withdrawal",
    { p_valor_cents: 5000, p_pix_key: "maria@pix.dev", p_pix_name: "Maria Souza" }
  );
  if (saqueErr) fail("solicitar saque 1", saqueErr);
  {
    const { error } = await db.rpc("pay_withdrawal", { p_withdrawal_id: saque1 });
    if (error) fail("pagar saque 1", error);
  }
  {
    const { error } = await mariaClient.rpc("request_withdrawal", {
      p_valor_cents: 5000,
      p_pix_key: "maria@pix.dev",
      p_pix_name: "Maria Souza",
    });
    if (error) fail("solicitar saque 2", error);
  }
  await mariaClient.auth.signOut();

  console.log("→ Cobranças da competência atual + uma confirmação...");
  {
    const { data, error } = await db.rpc("generate_monthly_charges");
    if (error) fail("gerar cobranças", error);
    console.log(`  ${data} cobrança(s) gerada(s).`);
  }
  {
    const { data: pgto, error } = await db
      .from("payments")
      .select("id")
      .eq("client_id", navalha)
      .eq("tipo", "mensalidade")
      .eq("competencia", competencia(0))
      .single();
    if (error) fail("localizar mensalidade da Navalha", error);
    await confirm(pgto.id); // comissão do mês para o João
  }

  console.log("\n✔ Seed concluído!\n");
  console.log("Contas para teste:");
  console.log(`  Admin:             ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Vendedor (João):   joao@parceiro.dev / ${SELLER_PASSWORD}`);
  console.log(`  Vendedora (Maria): maria@parceiro.dev / ${SELLER_PASSWORD}`);
  console.log(`  Pendente (Carlos): carlos@parceiro.dev / ${SELLER_PASSWORD}`);
  console.log("\nTroque a senha do admin após o primeiro login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
