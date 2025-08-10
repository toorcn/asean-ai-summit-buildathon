"use client"

import { useState, useEffect } from 'react'

export function MessageBubble({ role, content }: { role: 'user'|'assistant', content: string }) {
  const isUser = role === 'user'
  const isTyping = content === '...'
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const bubbleClass = `max-w-[80%] px-4 py-3 rounded-2xl transition-all duration-500 ease-out transform ${
    isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
  } ${
    isUser 
      ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/20 rounded-br-md' 
      : 'bg-gradient-to-br from-white/15 to-white/10 backdrop-blur border border-white/20 text-white/90 rounded-bl-md'
  } hover:scale-105 hover:shadow-xl transition-transform duration-200`

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={bubbleClass}>
        {isTyping ? <TypingDots /> : (
          <div className="leading-relaxed">
            {content}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <Dot delay={0} /> <Dot delay={0.15} /> <Dot delay={0.3} />
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span 
      className="w-2 h-2 rounded-full bg-white/70 inline-block animate-bounce" 
      style={{ animationDelay: `${delay}s` }} 
    />
  )
}
