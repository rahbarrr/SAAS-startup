import type { NextRequest, NextResponse } from "next/server";
import { updateSessionAndEnforceAuth } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return updateSessionAndEnforceAuth(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
