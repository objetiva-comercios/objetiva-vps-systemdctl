import type { SystemInfo } from '../types/service'
import { formatSystemUptime } from '../types/service'

interface SystemHeaderProps {
  systemInfo: SystemInfo | null
}

export default function SystemHeader({ systemInfo }: SystemHeaderProps) {
  if (!systemInfo) {
    return (
      <div className="flex items-center gap-4 px-4 py-2 bg-bg-surface border border-border rounded-md mb-4">
        <div className="w-2 h-2 rounded-full bg-text-muted animate-pulse"></div>
        <span className="text-text-muted text-xs font-mono">Loading system info...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-bg-surface border border-border rounded-md mb-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
        <span className="text-xs text-text-muted font-mono">online</span>
      </div>
      <div className="flex items-center gap-1 font-mono">
        <span className="text-xs text-text-muted">host:</span>
        <span className="text-xs text-text-primary">{systemInfo.hostname}</span>
      </div>
      <div className="flex items-center gap-1 font-mono">
        <span className="text-xs text-text-muted">up:</span>
        <span className="text-xs text-text-primary">{formatSystemUptime(systemInfo.uptimeSeconds)}</span>
      </div>
    </div>
  )
}
