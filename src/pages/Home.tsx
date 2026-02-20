import { useState, useEffect } from 'react'
import { RefreshCw, LoaderCircle } from 'lucide-react'
import { useServicePolling } from '../hooks/useServicePolling'
import type { ServiceEntry, SystemInfo } from '../types/service'
import SystemHeader from '../components/SystemHeader'
import ServiceTable from '../components/ServiceTable'

export default function Home() {
  const { services, setServices, loading, error, lastUpdated, refresh } = useServicePolling()
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    fetch('/api/system')
      .then(res => res.json())
      .then((data: SystemInfo) => setSystemInfo(data))
      .catch(() => {/* silently ignore — SystemHeader will show skeleton */})
  }, [])

  function handleServiceUpdate(updated: ServiceEntry) {
    setServices(prev => prev.map(s => s.unit === updated.unit ? updated : s))
  }

  const formattedLastUpdated = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="flex flex-col h-full">
      <SystemHeader systemInfo={systemInfo} />

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-4">
          {loading ? (
            <span className="flex items-center gap-2 text-text-muted text-xs font-mono">
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              Loading services...
            </span>
          ) : (
            <span className="text-text-muted text-xs font-mono">
              {services.length} services
            </span>
          )}
          {formattedLastUpdated && (
            <span className="text-text-muted text-xs font-mono">
              updated {formattedLastUpdated}
            </span>
          )}
          {error && (
            <span className="text-danger text-xs font-mono">{error}</span>
          )}
        </div>
        <button
          onClick={() => refresh()}
          title="Refresh now"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-text-muted text-xs font-mono hover:text-accent hover:bg-bg-elevated transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Service table */}
      <div className="flex-1 min-h-0 bg-bg-surface border border-border rounded-md overflow-auto">
        <ServiceTable services={services} onServiceUpdate={handleServiceUpdate} />
      </div>
    </div>
  )
}
