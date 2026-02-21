import { Search, X } from 'lucide-react'

export type StatusFilter = 'all' | 'running' | 'stopped' | 'failed'

interface SearchFilterBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: StatusFilter
  onStatusChange: (s: StatusFilter) => void
  totalCount: number
  filteredCount: number
  statusCounts: { all: number; running: number; stopped: number; failed: number }
}

const STATUS_BUTTONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Stopped', value: 'stopped' },
  { label: 'Failed', value: 'failed' },
]

export default function SearchFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  totalCount,
  filteredCount,
  statusCounts,
}: SearchFilterBarProps) {
  const filtersActive = searchQuery !== '' || statusFilter !== 'all'

  return (
    <div className="flex items-center gap-3 mb-3 px-1 flex-wrap">
      {/* Search input */}
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search services..."
          className="w-full pl-7 pr-7 py-1.5 bg-bg-elevated border border-border text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none rounded text-xs font-mono"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            title="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status filter buttons */}
      <div className="flex items-center gap-1">
        {STATUS_BUTTONS.map(btn => (
          <button
            key={btn.value}
            onClick={() => onStatusChange(btn.value)}
            className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
              statusFilter === btn.value
                ? 'bg-accent text-bg-base'
                : 'text-text-muted hover:text-accent border border-border hover:border-accent'
            }`}
          >
            {btn.label} ({statusCounts[btn.value]})
          </button>
        ))}
      </div>

      {/* Result count (only shown when filters are active) */}
      {filtersActive && (
        <span className="text-text-muted text-xs font-mono">
          {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  )
}
