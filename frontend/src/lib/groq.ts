import Groq from 'groq-sdk'

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  return new Groq({ apiKey })
}

export function getGroqModel() {
  // Default to Gemma 2 instruct. Override via env if desired.
  return process.env.GROQ_MODEL || 'gemma2-9b-it'
}
