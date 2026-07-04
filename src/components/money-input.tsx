"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";

/**
 * Input monetário estilo banco: o usuário digita apenas dígitos e o
 * valor desliza dos centavos (1 2 3 4 -> R$ 12,34). O valor real em
 * centavos vai no hidden input `name`, nunca em float.
 */
export function MoneyInput({
  name,
  id,
  defaultCents = 0,
  required,
  disabled,
  placeholder = "R$ 0,00",
}: {
  name: string;
  id?: string;
  defaultCents?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [cents, setCents] = useState(defaultCents);

  return (
    <>
      <input type="hidden" name={name} value={cents} />
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="tabular"
        value={cents > 0 ? formatBRL(cents) : ""}
        placeholder={placeholder}
        disabled={disabled}
        required={required && cents <= 0}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          setCents(digits ? parseInt(digits, 10) : 0);
        }}
      />
    </>
  );
}
