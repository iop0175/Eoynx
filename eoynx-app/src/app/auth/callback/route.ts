import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/feed";
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
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(exchangeError.message)}`);
  }

  // code가 없으면 클라이언트 측 핸들러 페이지로 이동
  // (이 페이지가 URL hash의 토큰을 처리함)
  return NextResponse.redirect(`${origin}/auth/callback/client`);
}
