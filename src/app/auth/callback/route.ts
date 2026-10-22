import { type NextRequest, NextResponse } from "next/server";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/modules/auth/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextPath = sanitizeRedirectPath(searchParams.get("next"), "/");

  if (code) {
    const supabase = await createUserServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${nextPath}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Unable+to+verify+authentication+link`
  );
}
