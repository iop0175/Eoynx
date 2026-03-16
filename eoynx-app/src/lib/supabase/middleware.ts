import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes('sb-') && cookie.name.includes('auth-token'))

  if (!hasAuthCookie) {
    return supabaseResponse
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신을 위해 getUser를 호출
  // 중요: auth.getUser()를 사용해야 합니다 (getSession이 아님)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isConsentRequired = user && !Boolean(user.user_metadata?.privacy_consent)
  const isAllowedPath =
    pathname.startsWith('/auth/consent') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/privacy-consent') ||
    pathname === '/auth'

  if (isConsentRequired && !isAllowedPath) {
    const nextPath = `${pathname}${request.nextUrl.search}`
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/consent'
    redirectUrl.search = `next=${encodeURIComponent(nextPath || '/feed')}`

    const redirectResponse = NextResponse.redirect(redirectUrl)
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }

    return redirectResponse
  }

  return supabaseResponse
}
