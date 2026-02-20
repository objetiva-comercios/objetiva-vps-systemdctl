import type { ServiceEntry } from '../types/service'
import ServiceRow from './ServiceRow'

interface ServiceTableProps {
  services: ServiceEntry[]
  onServiceUpdate: (updated: ServiceEntry) => void
}

export default function ServiceTable({ services, onServiceUpdate }: ServiceTableProps) {
  if (services.length === 0) {
    return (
      <div className="text-text-muted text-sm font-mono text-center py-8">
        No services found
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">Service</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">Status</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">Enabled</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">PID</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">Memory</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">CPU</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">Uptime</th>
            <th className="px-3 py-2 text-left text-text-muted text-xs uppercase tracking-wider font-mono">Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map(service => (
            <ServiceRow
              key={service.unit}
              service={service}
              onServiceUpdate={onServiceUpdate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
