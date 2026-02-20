import { useLocation } from 'react-router'

export default function ComingSoon() {
  const { pathname } = useLocation()
  const name = pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2)

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center">
        <h1 className="text-lg text-text-primary mb-2">{name}</h1>
        <p className="text-text-muted text-sm">Coming in a future phase</p>
      </div>
    </div>
  )
}
