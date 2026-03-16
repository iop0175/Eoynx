import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/feed";
  const next = requestedNext.startsWith("/") ? requestedNext : "/feed";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 에러가 있으면 표시
  if (error) {
    const errorMsg = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(`${origin}/auth?error=${errorMsg}`);
  }

  // PKCE flow: code가 있으면 교환
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!exchangeError) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const hasConsent = Boolean(user?.user_metadata?.privacy_consent);

      if (!hasConsent) {
        return NextResponse.redirect(
          `${origin}/auth/consent?next=${encodeURIComponent(next)}`
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
    
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`);
  }

  // code가 없으면 인증 흐름 오류로 처리
  return NextResponse.redirect(
    `${origin}/auth?error=${encodeURIComponent("Invalid authentication callback")}`
  );
}
