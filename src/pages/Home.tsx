import { CircleDot } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex items-start justify-center pt-12">
      <div className="bg-bg-surface border border-border rounded-lg p-8 w-full max-w-md">
        <h1 className="text-lg text-text-primary mb-6">System Status</h1>
        <div className="flex items-center gap-3 mb-4">
          <CircleDot className="w-5 h-5 text-accent" />
          <span className="text-accent font-mono">Server Running</span>
        </div>
        <p className="text-text-muted text-sm font-mono">
          systemdctl v0.1.0 — Phase 2 will add the service dashboard here
        </p>
      </div>
    </div>
  )
}
