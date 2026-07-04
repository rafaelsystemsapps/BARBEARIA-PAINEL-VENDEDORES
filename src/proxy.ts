import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Convenção "proxy" do Next.js 16 (substitui middleware.ts).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
