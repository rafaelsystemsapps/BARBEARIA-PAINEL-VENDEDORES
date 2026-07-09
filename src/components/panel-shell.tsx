"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BadgeCheck,
  Coins,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Store,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const SELLER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/carteira", label: "Minha carteira", icon: Store },
  { href: "/comissoes", label: "Comissões", icon: Coins },
  { href: "/saques", label: "Saques", icon: Banknote },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/vendedores", label: "Vendedores", icon: Users },
  { href: "/admin/gestores", label: "Gestores", icon: UsersRound },
  { href: "/admin/pagamentos", label: "Confirmar pagamentos", icon: BadgeCheck },
  { href: "/admin/clientes", label: "Clientes", icon: Store },
  { href: "/admin/saques", label: "Saques", icon: Banknote },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];

const GESTOR_NAV: NavItem[] = [
  { href: "/gestor", label: "Meu time", icon: UsersRound, exact: true },
  { href: "/gestor/comissoes", label: "Comissões", icon: Coins },
  { href: "/gestor/saques", label: "Saques", icon: Banknote },
  { href: "/gestor/perfil", label: "Perfil", icon: UserRound },
];

export function PanelShell({
  variant,
  userName,
  children,
}: {
  variant: "seller" | "admin" | "gestor";
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav =
    variant === "admin"
      ? ADMIN_NAV
      : variant === "gestor"
        ? GESTOR_NAV
        : SELLER_NAV;

  const variantLabel =
    variant === "admin"
      ? "Administração"
      : variant === "gestor"
        ? "Gestor"
        : "Vendedor";

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Scissors className="size-5" strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <p className="font-heading text-sm font-semibold">Painel de Parceiros</p>
          <p className="text-[11px] text-muted-foreground">
            {variantLabel}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="truncate text-sm font-medium">{userName}</p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh w-full">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-sidebar-border lg:block">
        {sidebar}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <span className="font-heading text-sm font-semibold">
            Painel de Parceiros
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
