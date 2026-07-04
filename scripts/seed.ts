/**
 * Seed de desenvolvimento.
 *
 * Uso: npm run seed   (lê .env.local; exige SUPABASE_SERVICE_ROLE_KEY)
 *
 * Cria: 1 admin (role=admin, status=ativo) e 1 vendedor pendente (Carlos)
 * para exercitar o fluxo de aprovação, além das configurações padrão do
 * painel. Idempotente: rodar 2× não recria nada.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = "admin@2026gmail.com";
const ADMIN_PASSWORD = "Admin@2026";
const SELLER_PASSWORD = "Vendedor@2026!";

if (!URL || !SERVICE_KEY) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local"
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
    return;
  }

  console.log("→ Criando usuários...");
  const adminId = await createUser(ADMIN_EMAIL, ADMIN_PASSWORD, "Administrador", "11 90000-0000");
  await createUser("carlos@parceiro.dev", SELLER_PASSWORD, "Carlos Lima", "31 93333-3333");

  console.log("→ Papéis e aprovações...");
  {
    const { error } = await db
      .from("profiles")
      .update({ role: "admin", status: "ativo" })
      .eq("id", adminId);
    if (error) fail("promover admin", error);
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

  console.log("\n✔ Seed concluído!\n");
  console.log("Contas para teste:");
  console.log(`  Admin:             ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Pendente (Carlos): carlos@parceiro.dev / ${SELLER_PASSWORD}`);
  console.log("\nTroque a senha do admin após o primeiro login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
