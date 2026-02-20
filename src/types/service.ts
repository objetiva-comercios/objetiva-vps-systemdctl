export interface ServiceEntry {
  unit: string
  load: string
  active: string        // 'active' | 'inactive' | 'failed' | 'activating' | 'deactivating'
  sub: string           // 'running' | 'dead' | 'exited' | 'failed' | 'waiting' | etc.
  description: string
  unitFileState: string // 'enabled' | 'disabled' | 'static' | 'masked' | ''
  pid: number | null
  memoryBytes: number | null
  cpuNsec: number | null
  activeEnterTimestamp: string | null
}

export interface SystemInfo {
  hostname: string
  uptimeSeconds: number
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatCpuTime(nsec: number | null): string {
  if (nsec === null) return '--'
  const ms = nsec / 1_000_000
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = s / 60
  return `${m.toFixed(1)}m`
}

export function formatUptime(timestamp: string | null): string {
  if (!timestamp) return '--'
  // Strip day-of-week prefix (e.g. "Thu 2024-01-18 12:34:56 UTC" -> "2024-01-18 12:34:56 UTC")
  const parts = timestamp.trim().split(/\s+/)
  const dateStr = parts.slice(1).join(' ')
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '--'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 0) return '--'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export function formatSystemUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
