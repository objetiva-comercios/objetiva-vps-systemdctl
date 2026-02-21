import { useState } from 'react'
import {
  CircleCheck,
  CircleAlert,
  CircleDot,
  Play,
  CircleStop,
  RefreshCw,
  Power,
  PowerOff,
  LoaderCircle,
  Star,
  StarOff,
} from 'lucide-react'
import type { ServiceEntry } from '../types/service'
import { formatBytes, formatCpuTime, formatUptime } from '../types/service'

interface ServiceRowProps {
  service: ServiceEntry
  onServiceUpdate: (updated: ServiceEntry) => void
  onToggleWatch: (unit: string, currentlyWatched: boolean) => void
}

function StatusIcon({ active }: { active: string }) {
  if (active === 'active') return <CircleCheck className="w-3.5 h-3.5 text-accent inline-block mr-1" />
  if (active === 'failed') return <CircleAlert className="w-3.5 h-3.5 text-danger inline-block mr-1" />
  return <CircleDot className="w-3.5 h-3.5 text-text-muted inline-block mr-1" />
}

function EnabledBadge({ state }: { state: string }) {
  if (state === 'enabled') {
    return (
      <span className="border border-accent text-accent text-xs px-1.5 py-0.5 rounded font-mono">
        enabled
      </span>
    )
  }
  if (state === 'disabled') {
    return (
      <span className="border border-text-muted text-text-muted text-xs px-1.5 py-0.5 rounded font-mono">
        disabled
      </span>
    )
  }
  if (state === 'static' || state === 'masked') {
    return (
      <span className="text-text-muted text-xs font-mono">{state}</span>
    )
  }
  return <span className="text-text-muted text-xs font-mono">--</span>
}

export default function ServiceRow({ service, onServiceUpdate, onToggleWatch }: ServiceRowProps) {
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleAction(action: string) {
    setActionPending(action)
    setActionError(null)
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(service.unit)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Action failed: ${res.status}`)
      }
      onServiceUpdate(data.service)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      setActionError(msg)
      setTimeout(() => setActionError(null), 3000)
    } finally {
      setActionPending(null)
    }
  }

  const isActive = service.active === 'active'
  const isEnabled = service.unitFileState === 'enabled'
  const isRunning = service.sub === 'running'
  const isDisabled = actionPending !== null

  return (
    <tr className="border-b border-border hover:bg-bg-elevated/50 transition-colors">
      {/* Service name */}
      <td className="px-3 py-2 max-w-xs">
        <span className="font-mono text-xs text-text-primary truncate block" title={service.unit}>
          {service.unit}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        <span className="flex items-center font-mono text-xs">
          <StatusIcon active={service.active} />
          <span className={
            service.active === 'active' ? 'text-accent' :
            service.active === 'failed' ? 'text-danger' :
            'text-text-muted'
          }>
            {service.sub}
          </span>
        </span>
      </td>

      {/* Enabled badge */}
      <td className="px-3 py-2">
        <EnabledBadge state={service.unitFileState} />
      </td>

      {/* PID */}
      <td className="px-3 py-2">
        <span className="font-mono text-xs text-text-muted">{service.pid ?? '--'}</span>
      </td>

      {/* Memory */}
      <td className="px-3 py-2">
        <span className="font-mono text-xs text-text-muted">{formatBytes(service.memoryBytes)}</span>
      </td>

      {/* CPU */}
      <td className="px-3 py-2">
        <span className="font-mono text-xs text-text-muted">{formatCpuTime(service.cpuNsec)}</span>
      </td>

      {/* Uptime */}
      <td className="px-3 py-2">
        <span className="font-mono text-xs text-text-muted">{formatUptime(service.activeEnterTimestamp)}</span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {actionError && (
            <span className="text-danger text-xs font-mono mr-1">{actionError}</span>
          )}

          {/* Star toggle (watch/unwatch) */}
          <button
            onClick={() => onToggleWatch(service.unit, service.isWatched)}
            title={service.isWatched ? 'Unwatch' : 'Watch'}
            className={`p-1 rounded transition-colors ${
              service.isWatched
                ? 'text-accent hover:text-accent/70'
                : 'text-text-muted hover:text-accent'
            }`}
          >
            {service.isWatched
              ? <Star className="w-3.5 h-3.5 fill-current" />
              : <StarOff className="w-3.5 h-3.5" />
            }
          </button>

          {/* Start (when inactive/dead/failed) */}
          {(!isActive || !isRunning) && service.active !== 'activating' && (
            <button
              onClick={() => handleAction('start')}
              disabled={isDisabled}
              title="Start"
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionPending === 'start'
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <Play className="w-3.5 h-3.5" />
              }
            </button>
          )}

          {/* Stop (when active/running) */}
          {isActive && isRunning && (
            <button
              onClick={() => handleAction('stop')}
              disabled={isDisabled}
              title="Stop"
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionPending === 'stop'
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <CircleStop className="w-3.5 h-3.5" />
              }
            </button>
          )}

          {/* Restart (when active/running) */}
          {isActive && isRunning && (
            <button
              onClick={() => handleAction('restart')}
              disabled={isDisabled}
              title="Restart"
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionPending === 'restart'
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
            </button>
          )}

          {/* Enable (when not enabled) */}
          {!isEnabled && service.unitFileState !== 'static' && service.unitFileState !== 'masked' && (
            <button
              onClick={() => handleAction('enable')}
              disabled={isDisabled}
              title="Enable"
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionPending === 'enable'
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <Power className="w-3.5 h-3.5" />
              }
            </button>
          )}

          {/* Disable (when enabled) */}
          {isEnabled && (
            <button
              onClick={() => handleAction('disable')}
              disabled={isDisabled}
              title="Disable"
              className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionPending === 'disable'
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <PowerOff className="w-3.5 h-3.5" />
              }
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
