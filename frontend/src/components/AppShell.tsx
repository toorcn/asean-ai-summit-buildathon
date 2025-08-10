"use client"

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Hospital, MessageSquare, FileText } from 'lucide-react'
import { PropsWithChildren, useEffect, useRef } from 'react'
import clsx from 'clsx'

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const updateVar = () => {
      const h = navRef.current?.offsetHeight ?? 56
      document.documentElement.style.setProperty('--app-nav-h', `${h}px`)
    }
    updateVar()
    window.addEventListener('resize', updateVar)
    return () => window.removeEventListener('resize', updateVar)
  }, [])
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur bg-black/30 border-b border-white/10">
        <div className="bg-white max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          {/* Brand logo */}
          <Image
            src="/CARe-logo.png"
            alt="CARe logo"
            width={120}
            height={28}
            priority
            className="h-7 w-auto"
          />
          <div>
            <div className="text-sm text-brand-600 leading-tight">CARe</div>
            <div className="text-xs text-brand-400 leading-tight">Your AI-driven hospital navigator</div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-xl w-full mx-auto" style={{ paddingBottom: 'var(--app-nav-h, 56px)' }}>{children}</main>
      <nav ref={navRef} className="sticky bottom-0 z-40 bg-black/40 backdrop-blur border-t border-white/10" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="max-w-xl mx-auto grid grid-cols-3">
          <Tab href="/" active={pathname === '/'} icon={<Hospital className="w-5 h-5"/>} label="Home" />
          <Tab href="/chat" active={pathname.startsWith('/chat')} icon={<MessageSquare className="w-5 h-5"/>} label="Chat" />
          <Tab href="/summary" active={pathname.startsWith('/summary')} icon={<FileText className="w-5 h-5"/>} label="Summary" />
        </div>
      </nav>
    </div>
  )
}

type AppRoute = '/' | '/chat' | '/summary'
function Tab({ href, active, icon, label }: { href: AppRoute; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className={clsx("flex flex-col items-center py-2 text-xs", active ? "text-white" : "text-white/50")}
      onClick={() => { if (navigator.vibrate) navigator.vibrate(10) }}>
      {icon}
      <span className="mt-1">{label}</span>
    </Link>
  )
}
