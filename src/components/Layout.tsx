import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router'
import { Terminal, Server, ScrollText, Settings } from 'lucide-react'
import type { SystemInfo } from '../types/service'

function Header() {
  const [hostname, setHostname] = useState<string>('localhost')

  useEffect(() => {
    fetch('/api/system')
      .then(res => res.json())
      .then((data: SystemInfo) => setHostname(data.hostname))
      .catch(() => {/* keep 'localhost' fallback on error */})
  }, [])

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-bg-surface border-b border-border flex-shrink-0">
      <div className="flex items-center gap-3">
        <Terminal className="w-5 h-5 text-accent" />
        <span className="font-mono text-accent font-medium tracking-wide">systemdctl</span>
      </div>
      <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
        <span>{hostname}</span>
      </div>
    </header>
  )
}

function Sidebar() {
  const navItems = [
    { icon: Server, label: 'Services', to: '/' },
    { icon: ScrollText, label: 'Logs', to: '/logs' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ]

  return (
    <aside className="w-56 flex-shrink-0 bg-bg-surface border-r border-border flex flex-col">
      <nav className="flex-1 py-4">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-md mx-2 text-sm font-mono transition-colors ${
                isActive
                  ? 'text-accent bg-bg-elevated'
                  : 'text-text-muted hover:text-accent'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default function Layout() {
  return (
    <div className="h-screen flex flex-col bg-bg-base">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
