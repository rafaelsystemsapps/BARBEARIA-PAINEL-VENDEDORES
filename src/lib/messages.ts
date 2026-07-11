import { formatBRL } from "@/lib/format";

/**
 * Mensagem pronta para o vendedor enviar ao lead com a chave PIX.
 * Copiada em vez da chave crua, para o vendedor só colar no WhatsApp.
 */
export function mensagemPix(pixKey: string, barbearia?: string | null): string {
  const saudacao = barbearia ? `Olá! Sobre a ${barbearia}: ` : "Olá! ";
  return (
    `${saudacao}segue a chave PIX (CNPJ) para o pagamento da mensalidade do sistema:\n\n` +
    `${pixKey}\n\n` +
    `Assim que o pagamento for feito, é só me avisar que eu confirmo a ativação. Obrigado!`
  );
}

/** Só os dígitos do telefone, com DDI do Brasil para o wa.me. */
export function whatsappLink(numero: string | null, mensagem: string): string | null {
  if (!numero) return null;
  const digits = numero.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Adiciona 55 se o número não vier com DDI.
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(mensagem)}`;
}

/** Mensagem de aviso: mensalidade prestes a vencer. */
export function mensagemAVencer(
  barbearia: string,
  valorCents: number,
  dia: number | null,
  pixKey?: string | null
): string {
  const quando = dia ? `no dia ${dia}` : "em breve";
  const pix = pixKey ? `\n\nChave PIX (CNPJ): ${pixKey}` : "";
  return (
    `Olá! Passando para lembrar que a mensalidade do sistema da ${barbearia} ` +
    `(${formatBRL(valorCents)}) vence ${quando}.` +
    pix +
    `\n\nQualquer dúvida, é só chamar!`
  );
}

/** Mensagem de cobrança: mensalidade vencida. */
export function mensagemVencida(
  barbearia: string,
  valorCents: number,
  pixKey?: string | null
): string {
  const pix = pixKey ? `\n\nChave PIX (CNPJ): ${pixKey}` : "";
  return (
    `Olá! A mensalidade do sistema da ${barbearia} (${formatBRL(valorCents)}) ` +
    `está em aberto. Para não perder o acesso ao sistema, é só efetuar o pagamento.` +
    pix +
    `\n\nSe já pagou, pode desconsiderar. Qualquer dúvida, estou à disposição!`
  );
}
