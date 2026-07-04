/**
 * Teste de isolamento por RLS (critério de aceite #2 do PRD).
 *
 * Uso: npm run test:rls   (depois de `npm run seed`)
 *
 * Loga como o vendedor João (via anon key, exatamente como o app) e
 * verifica, VIA API, que ele não enxerga nenhum dado da Maria: leads,
 * clients, payments, commission_entries e withdrawals. Também confirma
 * que ele não consegue confirmar pagamentos nem alterar o próprio papel.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON || !SERVICE) {
  console.error("Defina as variáveis do Supabase no .env.local");
  process.exit(1);
}

const SELLER_PASSWORD = "Vendedor@2026!";
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // IDs reais da Maria e do João a partir do banco (via service role)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("email", ["joao@parceiro.dev", "maria@parceiro.dev"]);
  const maria = profiles?.find((p) => p.email === "maria@parceiro.dev");
  const joao = profiles?.find((p) => p.email === "joao@parceiro.dev");
  if (!maria || !joao) {
    console.error("Rode `npm run seed` antes deste teste.");
    process.exit(1);
  }

  // IDs de dados da Maria (para tentar acessar como João)
  const [{ data: mariaLead }, { data: mariaClient }, { data: mariaWd }] =
    await Promise.all([
      admin.from("leads").select("id").eq("seller_id", maria.id).limit(1).single(),
      admin.from("clients").select("id").eq("seller_id", maria.id).limit(1).single(),
      admin
        .from("withdrawals")
        .select("id")
        .eq("seller_id", maria.id)
        .limit(1)
        .single(),
    ]);
  const { data: mariaPayment } = await admin
    .from("payments")
    .select("id")
    .eq("client_id", mariaClient!.id)
    .limit(1)
    .single();

  // Login como João, via anon key (mesmo caminho do app)
  const joaoApi = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: loginErr } = await joaoApi.auth.signInWithPassword({
    email: "joao@parceiro.dev",
    password: SELLER_PASSWORD,
  });
  if (loginErr) {
    console.error("Falha no login do João:", loginErr.message);
    process.exit(1);
  }

  console.log("\nIsolamento de dados (João NÃO deve ver nada da Maria):");

  const leadsVisiveis = await joaoApi.from("leads").select("seller_id");
  check(
    "leads: só os próprios",
    (leadsVisiveis.data ?? []).every((r) => r.seller_id === joao.id) &&
      (leadsVisiveis.data?.length ?? 0) > 0,
    `retornou ${leadsVisiveis.data?.length ?? 0} linhas`
  );

  const clientsVisiveis = await joaoApi.from("clients").select("seller_id");
  check(
    "clients: só os próprios",
    (clientsVisiveis.data ?? []).every((r) => r.seller_id === joao.id)
  );

  const entriesVisiveis = await joaoApi
    .from("commission_entries")
    .select("seller_id");
  check(
    "commission_entries: só as próprias",
    (entriesVisiveis.data ?? []).every((r) => r.seller_id === joao.id)
  );

  const wdVisiveis = await joaoApi.from("withdrawals").select("seller_id");
  check(
    "withdrawals: só os próprios",
    (wdVisiveis.data ?? []).every((r) => r.seller_id === joao.id)
  );

  // Acesso direto por ID a linhas da Maria -> deve vir vazio
  const leadDaMaria = await joaoApi
    .from("leads")
    .select("id")
    .eq("id", mariaLead!.id);
  check("lead da Maria por ID: bloqueado", (leadDaMaria.data?.length ?? 0) === 0);

  const clientDaMaria = await joaoApi
    .from("clients")
    .select("id")
    .eq("id", mariaClient!.id);
  check("client da Maria por ID: bloqueado", (clientDaMaria.data?.length ?? 0) === 0);

  const paymentDaMaria = await joaoApi
    .from("payments")
    .select("id")
    .eq("id", mariaPayment!.id);
  check(
    "payment da Maria por ID: bloqueado",
    (paymentDaMaria.data?.length ?? 0) === 0
  );

  const wdDaMaria = await joaoApi
    .from("withdrawals")
    .select("id")
    .eq("id", mariaWd!.id);
  check("withdrawal da Maria por ID: bloqueado", (wdDaMaria.data?.length ?? 0) === 0);

  console.log("\nEscrita indevida (deve ser negada):");

  // Tentar confirmar o pagamento da Maria (função só-admin)
  const confirmTry = await joaoApi.rpc("confirm_payment", {
    p_payment_id: mariaPayment!.id,
    p_valor_pago_cents: null,
  });
  check("confirm_payment como vendedor: negado", Boolean(confirmTry.error));

  // Tentar se auto-promover a admin
  await joaoApi.from("profiles").update({ role: "admin" }).eq("id", joao.id);
  const { data: joaoDepois } = await admin
    .from("profiles")
    .select("role")
    .eq("id", joao.id)
    .single();
  check("auto-promoção a admin: bloqueada", joaoDepois?.role === "seller");

  // Tentar inserir lead em nome da Maria
  const insertTry = await joaoApi.from("leads").insert({
    seller_id: maria.id,
    nome_contato: "Hacker",
    barbearia: "Fake",
    status: "novo",
  });
  check("inserir lead para outro vendedor: negado", Boolean(insertTry.error));

  await joaoApi.auth.signOut();

  console.log(`\n${failed === 0 ? "✔" : "✖"} ${passed} passaram, ${failed} falharam.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
