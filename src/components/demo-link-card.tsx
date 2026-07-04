"use client";

import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, QrCode } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DemoLinkCard({
  demoUrl,
  refCode,
}: {
  demoUrl: string | null;
  refCode: string | null;
}) {
  const ready = Boolean(demoUrl && refCode);
  const link = ready
    ? `${demoUrl}${demoUrl!.includes("?") ? "&" : "?"}ref=${refCode}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <QrCode className="size-4 text-primary" />
          Seu link de demonstração
        </CardTitle>
        <CardDescription>
          Apresente o sistema com o seu link — é assim que a venda fica marcada
          como sua.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            {!refCode
              ? "Seu código de vendedor será definido pelo administrador na aprovação."
              : "O administrador ainda não configurou a URL da demonstração."}
          </p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="rounded-lg bg-white p-2.5 shadow-sm">
              <QRCodeSVG value={link!} size={116} marginSize={0} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
                {link}
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={link!} label="Copiar link" />
                <Button asChild size="sm" variant="ghost">
                  <a href={link!} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    Abrir demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
