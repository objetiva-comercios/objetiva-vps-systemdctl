import { Routes, Route } from 'react-router'
import Layout from './components/Layout'

function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-accent font-mono text-sm">
        <span className="animate-pulse">&#9632;</span>
        <span>system ready</span>
      </div>
      <h1 className="text-2xl font-mono text-text-primary">systemdctl</h1>
      <p className="text-text-muted text-sm">
        Server management panel — Phase 1 foundation running.
      </p>
      <div className="mt-4 p-4 bg-bg-surface border border-border rounded text-xs font-mono text-text-muted">
        <div>$ systemctl status</div>
        <div className="text-accent mt-1">&#10003; API server listening on http://127.0.0.1:7700</div>
        <div className="text-accent">&#10003; SQLite database initialized with WAL mode</div>
        <div className="text-accent">&#10003; execFile security wrapper active</div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  )
}

export default App
