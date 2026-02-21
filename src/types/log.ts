export interface LogEntry {
  ts: string | null
  priority: number
  level: 'error' | 'warning' | 'info'
  identifier: string
  message: string
}
