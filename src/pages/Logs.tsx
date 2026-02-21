import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { Clock, AlertTriangle, RotateCw, ArrowLeft, LoaderCircle } from 'lucide-react'
import type { LogEntry } from '../types/log'

const PRESETS = [
  { label: 'Last 5m', value: '5m' },
  { label: 'Last 15m', value: '15m' },
  { label: 'Last 1h', value: '1h' },
  { label: 'Last 6h', value: '6h' },
  { label: 'Last 1d', value: '1d' },
  { label: 'All', value: 'all' },
]

function LogLine({ entry }: { entry: LogEntry }) {
  const colorClass =
    entry.level === 'error'
      ? 'text-danger'
      : entry.level === 'warning'
      ? 'text-warning'
      : 'text-text-primary'

  return (
    <div className={`font-mono text-xs leading-5 whitespace-pre-wrap break-all ${colorClass}`}>
      <span className="text-text-muted mr-2 select-none">
        {entry.ts?.slice(11, 23) ?? '--'}
      </span>
      <span className="text-text-muted mr-2 select-none">
        {entry.identifier}
      </span>
      {entry.message}
    </div>
  )
}

function LogViewer({ service }: { service: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [since, setSince] = useState('all')
  const logContainerRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/logs/${encodeURIComponent(service)}?lines=100&since=${since}`
      )
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Request failed: ${res.status}`)
      }
      setEntries(data.entries)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load logs'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [service, since])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Auto-scroll to bottom after entries update
  useEffect(() => {
    if (logContainerRef.current && !loading) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [entries, loading])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title="Back to Services"
            className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-elevated transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-mono text-sm text-text-primary font-medium">
            {service}
          </h1>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          title="Refresh logs"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-text-muted text-xs font-mono hover:text-accent hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            : <RotateCw className="w-3.5 h-3.5" />
          }
          Refresh
        </button>
      </div>

      {/* Time preset bar */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        {PRESETS.map(preset => (
          <button
            key={preset.value}
            onClick={() => setSince(preset.value)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              since === preset.value
                ? 'bg-accent text-bg-base'
                : 'bg-bg-surface text-text-muted hover:text-accent border border-border'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Log list area */}
      <div
        ref={logContainerRef}
        className="flex-1 min-h-0 overflow-auto bg-bg-surface border border-border rounded-md p-3"
      >
        {loading && (
          <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            Loading logs...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-danger text-xs font-mono">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="text-text-muted text-xs font-mono">
            No log entries for this time range.
          </p>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-0.5">
            {entries.map((entry, i) => (
              <LogLine key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Logs() {
  const { service } = useParams<{ service?: string }>()

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted font-mono">
        <p className="text-sm">Select a service to view logs.</p>
        <Link to="/" className="text-xs text-accent hover:underline">
          &larr; Back to Services
        </Link>
      </div>
    )
  }

  return <LogViewer service={service} />
}
