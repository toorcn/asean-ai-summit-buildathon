export function ErrorBanner({ message, onRetry }: { message: string, onRetry?: () => void }) {
  return (
    <div className="p-3 rounded-md bg-red-600/20 border border-red-600/40 text-sm flex items-center justify-between">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="text-red-300 underline">Retry</button>}
    </div>
  )
}
