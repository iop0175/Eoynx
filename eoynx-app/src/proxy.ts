import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  try {
    const canonicalUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.eoynx.com').trim()
    const canonicalHost = new URL(canonicalUrl).host
    const apexHost = canonicalHost.startsWith('www.') ? canonicalHost.slice(4) : null

    if (apexHost && request.nextUrl.host === apexHost) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.host = canonicalHost
      redirectUrl.protocol = 'https:'
      return NextResponse.redirect(redirectUrl, 301)
    }
  } catch {
    // Ignore malformed env values and continue normal flow.
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 다음으로 시작하는 경로를 제외한 모든 경로에 대해 매칭:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘)
     * - 이미지 파일들
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}