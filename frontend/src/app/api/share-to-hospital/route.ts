import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/sessionStore'

export async function POST(req: NextRequest) {
  const { sessionToken } = await req.json().catch(() => ({}))
  const sess = sessionStore.ensure(sessionToken)
  const token = sess.token
  
  // Get base URL from environment or construct from request headers
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) {
    const host = req.headers.get('host')
    const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
    baseUrl = `${protocol}://${host}`
  }
  
  const url = `${baseUrl}/r/${token}`
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await new Promise(r => setTimeout(r, 300))
  return NextResponse.json({ url, token, expiresAt })
}
