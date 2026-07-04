import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatDate } from "@/lib/format";
import type { Client, Profile } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Carteira do vendedor" };

export default async function VendedorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [sellerRes, clientsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("clients")
      .select("*")
      .eq("seller_id", id)
      .order("closed_at", { ascending: false }),
  ]);

  const seller = sellerRes.data as Profile | null;
  if (!seller) notFound();

  const clients = (clientsRes.data ?? []) as Client[];
  const ativos = clients.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((s, c) => s + c.mensalidade_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/admin/vendedores">
              <ArrowLeft className="size-4" />
              Vendedores
            </Link>
          </Button>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {seller.nome || seller.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {seller.email} · {seller.whatsapp ?? "sem WhatsApp"} ·{" "}
            {seller.ref_code ? `código ${seller.ref_code}` : "sem código"} ·{" "}
            {ativos.length} ativos · MRR {formatBRL(mrr)}
          </p>
        </div>
        <StatusBadge status={seller.status} />
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Este vendedor ainda não fechou nenhum cliente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbearia</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="text-right">% rec.</TableHead>
                <TableHead className="hidden md:table-cell text-right">Setup</TableHead>
                <TableHead className="hidden lg:table-cell">Fechado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.barbearia}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.cidade ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatBRL(c.mensalidade_cents)}
                  </TableCell>
                  <TableCell className="tabular text-right text-primary">
                    {c.pct_recorrente}%
                  </TableCell>
                  <TableCell className="tabular hidden md:table-cell text-right text-muted-foreground">
                    {c.tem_setup && c.setup_cents
                      ? `${formatBRL(c.setup_cents)} (${c.pct_setup}%)`
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(c.closed_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
