import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, LoaderCircle, Star } from 'lucide-react'
import { useServicePolling } from '../hooks/useServicePolling'
import type { ServiceEntry, SystemInfo } from '../types/service'
import SystemHeader from '../components/SystemHeader'
import ServiceTable from '../components/ServiceTable'
import SearchFilterBar from '../components/SearchFilterBar'
import type { StatusFilter } from '../components/SearchFilterBar'

export default function Home() {
  const { services, setServices, loading, error, lastUpdated, refresh } = useServicePolling()
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    fetch('/api/system')
      .then(res => res.json())
      .then((data: SystemInfo) => setSystemInfo(data))
      .catch(() => {/* silently ignore — SystemHeader will show skeleton */})
  }, [])

  function handleServiceUpdate(updated: ServiceEntry) {
    setServices(prev => prev.map(s => s.unit === updated.unit ? updated : s))
  }

  async function handleToggleWatch(unit: string, currentlyWatched: boolean) {
    // Optimistic update: immediately toggle isWatched
    setServices(prev => prev.map(s =>
      s.unit === unit ? { ...s, isWatched: !currentlyWatched } : s
    ))

    try {
      const method = currentlyWatched ? 'DELETE' : 'POST'
      const res = await fetch(`/api/watched/${encodeURIComponent(unit)}`, { method })
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`)
      }
    } catch {
      // Revert optimistic update on failure
      setServices(prev => prev.map(s =>
        s.unit === unit ? { ...s, isWatched: currentlyWatched } : s
      ))
    }
  }

  // Derived: services filtered by search query and status filter
  const filteredServices = useMemo(() => {
    let result = services

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s => s.unit.toLowerCase().includes(q))
    }

    if (statusFilter === 'running') {
      result = result.filter(s => s.sub === 'running')
    } else if (statusFilter === 'stopped') {
      result = result.filter(s => s.active === 'inactive')
    } else if (statusFilter === 'failed') {
      result = result.filter(s => s.active === 'failed')
    }

    return result
  }, [services, searchQuery, statusFilter])

  // Derived: watched services from the full (unfiltered) service list
  const watchedServices = useMemo(() => {
    return services.filter(s => s.isWatched)
  }, [services])

  // Derived: status counts from the full (unfiltered) service list
  const statusCounts = useMemo(() => {
    return services.reduce(
      (acc, s) => {
        acc.all++
        if (s.sub === 'running') acc.running++
        else if (s.active === 'inactive') acc.stopped++
        else if (s.active === 'failed') acc.failed++
        return acc
      },
      { all: 0, running: 0, stopped: 0, failed: 0 }
    )
  }, [services])

  const filtersActive = searchQuery !== '' || statusFilter !== 'all'

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
              {filtersActive
                ? `${filteredServices.length} of ${services.length} services`
                : `${services.length} services`
              }
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

      {/* Search and filter bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        totalCount={services.length}
        filteredCount={filteredServices.length}
        statusCounts={statusCounts}
      />

      {/* Watched services section (above main table, unaffected by search/filter) */}
      {watchedServices.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Star className="w-3.5 h-3.5 text-accent fill-current" />
            <span className="text-text-muted text-xs font-mono uppercase tracking-wider">
              Watched ({watchedServices.length})
            </span>
          </div>
          <div className="bg-bg-surface border border-accent/20 rounded-md overflow-auto">
            <ServiceTable
              services={watchedServices}
              onServiceUpdate={handleServiceUpdate}
              onToggleWatch={handleToggleWatch}
              isWatchedSection
            />
          </div>
        </div>
      )}

      {/* Main service table */}
      <div className="flex-1 min-h-0 bg-bg-surface border border-border rounded-md overflow-auto">
        <ServiceTable
          services={filteredServices}
          onServiceUpdate={handleServiceUpdate}
          onToggleWatch={handleToggleWatch}
        />
      </div>
    </div>
  )
}
