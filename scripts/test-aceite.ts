/**
 * Verifica os critérios de aceite do PRD §13 (exceto o nº 2, coberto
 * por test-rls.ts) contra os dados do seed, via service role.
 *
 * Uso: npm run test:aceite   (depois de `npm run seed`)
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function clientByBarbearia(nome: string) {
  const { data } = await db.from("clients").select("*").eq("barbearia", nome).single();
  return data!;
}

async function main() {
  console.log("\nCritério 3 — percentuais congelados no fechamento:");
  const navalha = await clientByBarbearia("Navalha de Ouro"); // sem setup
  check("só-mensalidade grava 30% recorrente", navalha.pct_recorrente === 30);
  check("só-mensalidade não tem setup", navalha.tem_setup === false && navalha.pct_setup === null);

  const imperial = await clientByBarbearia("Barbearia Imperial"); // setup R$ 800,00
  check("com setup grava 40% recorrente", imperial.pct_recorrente === 40);
  check("setup R$ 800,00 → 20% (limite da faixa)", imperial.setup_cents === 80000 && imperial.pct_setup === 20);

  const prime = await clientByBarbearia("Barber Prime"); // setup R$ 800,01
  check("setup R$ 800,01 → 30% (primeiro centavo da faixa)", prime.setup_cents === 80001 && prime.pct_setup === 30);

  const domCorte = await clientByBarbearia("Dom Corte"); // setup R$ 1.200,00
  check("setup R$ 1.200,00 → 30%", domCorte.setup_cents === 120000 && domCorte.pct_setup === 30);

  console.log("\nCritério 4 — comissão confirmada com valor exato:");
  // Imperial: setup R$ 800,00 confirmado → comissão 20% = R$ 160,00 (16000)
  const { data: imperialEntry } = await db
    .from("commission_entries")
    .select("valor_cents, status, tipo")
    .eq("client_id", imperial.id)
    .eq("tipo", "setup")
    .single();
  check(
    "comissão de setup = 20% de R$ 800,00 = R$ 160,00",
    imperialEntry?.valor_cents === 16000 && imperialEntry?.status === "disponivel",
    `veio ${imperialEntry?.valor_cents}`
  );

  // Estilo Clássico: mensalidade 14990 × 30% = 4497, 3 meses confirmados.
  // Obs.: os saques da Maria dividem entries em FIFO (parte reservada +
  // parte que volta ao saldo), então o total de entries pode ser > 3;
  // o que deve ser exato é a SOMA (comissão preservada) e a comissão por
  // pagamento confirmado.
  const estilo = await clientByBarbearia("Estilo Clássico");
  const { count: mensConfirmadas } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", estilo.id)
    .eq("tipo", "mensalidade")
    .eq("status", "confirmado");
  const { data: estiloEntries } = await db
    .from("commission_entries")
    .select("valor_cents")
    .eq("client_id", estilo.id)
    .eq("tipo", "mensalidade");
  const somaEstilo = (estiloEntries ?? []).reduce((s, e) => s + e.valor_cents, 0);
  check(
    "3 mensalidades confirmadas × (14990 × 30% = 4497) = 13491 total",
    mensConfirmadas === 3 && somaEstilo === 3 * 4497,
    `${mensConfirmadas} confirmadas, soma ${somaEstilo}`
  );

  console.log("\nCritério 5 — sem confirmação, nenhuma comissão nasce:");
  // Barber Prime: setup aguardando, nunca confirmado → 0 comissões
  const { count: primeCount } = await db
    .from("commission_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", prime.id);
  check("Barber Prime (setup não confirmado) → 0 comissões", primeCount === 0);

  // Nenhuma comissão para pagamentos ainda 'aguardando'
  const { data: aguardando } = await db
    .from("payments")
    .select("id")
    .eq("status", "aguardando");
  const idsAguardando = (aguardando ?? []).map((p) => p.id);
  const { count: comissaoDeAguardando } = await db
    .from("commission_entries")
    .select("id", { count: "exact", head: true })
    .in("payment_id", idsAguardando.length ? idsAguardando : ["00000000-0000-0000-0000-000000000000"]);
  check("nenhum pagamento 'aguardando' tem comissão", (comissaoDeAguardando ?? 0) === 0);

  console.log("\nCritério 6 — saldo e saque:");
  const { data: maria } = await db
    .from("profiles")
    .select("id")
    .eq("email", "maria@parceiro.dev")
    .single();

  // seller_balance pelo caminho real: a própria Maria logada (auth.uid()
  // = maria) via anon key, exatamente como o dashboard dela chama.
  const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await anon.auth.signInWithPassword({ email: "maria@parceiro.dev", password: "Vendedor@2026!" });
  const { data: saldoMaria } = await anon.rpc("seller_balance");

  // Total de comissões da Maria menos saques pagos/solicitados (reservados)
  const { data: entriesMaria } = await db
    .from("commission_entries")
    .select("valor_cents, status, withdrawal_id")
    .eq("seller_id", maria!.id);
  const disponivelLivre = (entriesMaria ?? [])
    .filter((e) => e.status === "disponivel" && e.withdrawal_id === null)
    .reduce((s, e) => s + e.valor_cents, 0);
  check(
    "seller_balance (Maria logada) = soma das entries disponíveis não reservadas",
    Number(saldoMaria) === disponivelLivre,
    `rpc ${saldoMaria} vs calc ${disponivelLivre}`
  );

  const sacadas = (entriesMaria ?? []).filter((e) => e.status === "sacada");
  const { data: saquePago } = await db
    .from("withdrawals")
    .select("id, valor_cents")
    .eq("seller_id", maria!.id)
    .eq("status", "pago")
    .single();
  const somaSacadas = sacadas.reduce((s, e) => s + e.valor_cents, 0);
  check(
    "saque pago → entries viram 'sacada' e batem com o valor do saque",
    saquePago != null && somaSacadas === saquePago.valor_cents && sacadas.every((e) => e.withdrawal_id === saquePago.id),
    `sacadas ${somaSacadas} vs saque ${saquePago?.valor_cents}`
  );

  // Saque acima do saldo deve ser rejeitado pela função (Maria ainda logada)
  const excesso = await anon.rpc("request_withdrawal", {
    p_valor_cents: Number(saldoMaria) + 100000,
    p_pix_key: "maria@pix.dev",
    p_pix_name: "Maria Souza",
  });
  check("saque acima do saldo → rejeitado", Boolean(excesso.error));
  await anon.auth.signOut();

  console.log("\nCritério 7 — geração de cobranças é idempotente:");
  const { count: antes } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "mensalidade");
  await db.rpc("generate_monthly_charges");
  await db.rpc("generate_monthly_charges");
  const { count: depois } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "mensalidade");
  check("rodar generate_monthly_charges 2× não duplica", antes === depois, `${antes} → ${depois}`);

  console.log(`\n${failed === 0 ? "✔" : "✖"} ${passed} passaram, ${failed} falharam.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
