import { NextResponse, NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // Provide a default base URL for share link if not set
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    const url = req.nextUrl
    process.env.NEXT_PUBLIC_BASE_URL = `${url.protocol}//${url.host}`
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
