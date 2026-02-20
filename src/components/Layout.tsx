import { Outlet } from 'react-router'
import { Server, List, Settings, Activity } from 'lucide-react'

function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-bg-surface border-b border-border flex-shrink-0">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-accent" />
        <span className="font-mono text-text-primary font-medium tracking-wide">systemdctl</span>
      </div>
      <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
        <span>localhost</span>
      </div>
    </header>
  )
}

function Sidebar() {
  const navItems = [
    { icon: List, label: 'Services', href: '/' },
    { icon: Server, label: 'Audit', href: '/audit' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

  return (
    <aside className="w-56 flex-shrink-0 bg-bg-surface border-r border-border flex flex-col">
      <nav className="flex-1 py-4">
        {navItems.map(({ icon: Icon, label, href }) => (
          <a
            key={label}
            href={href}
            className="flex items-center gap-3 px-4 py-2 text-sm font-mono text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <Icon className="w-4 h-4" />
            {label}
          </a>
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
