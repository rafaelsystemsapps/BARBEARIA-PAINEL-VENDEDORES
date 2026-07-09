import { requireGestor } from "@/lib/auth";
import { ProfileForm } from "@/app/(vendedor)/perfil/profile-form";

export const metadata = { title: "Perfil" };

export default async function GestorPerfilPage() {
  const profile = await requireGestor();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus dados de contato e a chave PIX usada nos saques do override.
        </p>
      </div>

      <ProfileForm
        nome={profile.nome}
        email={profile.email}
        whatsapp={profile.whatsapp ?? ""}
        pixKey={profile.pix_key ?? ""}
        pixName={profile.pix_name ?? ""}
        refCode={profile.team_code}
      />
    </div>
  );
}
