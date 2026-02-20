import { useState, useEffect, useRef, useCallback } from 'react'
import type { ServiceEntry } from '../types/service'

interface UseServicePollingResult {
  services: ServiceEntry[]
  setServices: React.Dispatch<React.SetStateAction<ServiceEntry[]>>
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => void
}

export function useServicePolling(): UseServicePollingResult {
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const isFetching = useRef<boolean>(false)

  const fetchServices = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const res = await fetch('/api/services')
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setServices(data.services)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services')
    } finally {
      isFetching.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
    const interval = setInterval(fetchServices, 10_000)
    return () => clearInterval(interval)
  }, [fetchServices])

  return { services, setServices, loading, error, lastUpdated, refresh: fetchServices }
}
