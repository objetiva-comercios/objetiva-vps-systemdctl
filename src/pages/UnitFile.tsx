import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import {
  ArrowLeft,
  AlertTriangle,
  LoaderCircle,
  Pencil,
  Save,
  X,
  Check,
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import type { UnitFileInfo } from '../types/unit'

// Module-level constant — NOT inside the component to avoid per-render recreation
const systemdLang = StreamLanguage.define(properties)

function UnitFileViewer({ service }: { service: string }) {
  const [unitInfo, setUnitInfo] = useState<UnitFileInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fetchUnitFile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/unit/${encodeURIComponent(service)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Request failed: ${res.status}`)
      }
      setUnitInfo(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load unit file'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    fetchUnitFile()
  }, [fetchUnitFile])

  async function handleSave() {
    if (!unitInfo) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/unit/${encodeURIComponent(service)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Save failed')
      }
      setUnitInfo({ ...unitInfo, content: editContent })
      setEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  function handleEnterEdit() {
    if (!unitInfo) return
    setEditContent(unitInfo.content)
    setEditing(true)
    setSaveError(null)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditContent('')
    setSaveError(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title="Back to Services"
            className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-elevated transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-mono text-sm text-text-primary font-medium">
              {service}
            </h1>
            {unitInfo && (
              <span className="text-text-muted text-xs font-mono">{unitInfo.path}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save success flash */}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-accent text-xs font-mono">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}

          {/* Save error */}
          {saveError && (
            <span className="flex items-center gap-1 text-danger text-xs font-mono">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {saveError}
            </span>
          )}

          {unitInfo && !editing && (
            <button
              onClick={handleEnterEdit}
              disabled={!unitInfo.writable}
              title={unitInfo.writable ? 'Edit file' : 'Package-managed file — editing not allowed'}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                unitInfo.writable
                  ? 'text-text-muted hover:text-accent hover:bg-bg-elevated'
                  : 'text-text-muted opacity-40 cursor-not-allowed'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving || editContent === unitInfo?.content}
                title="Save changes"
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono text-text-muted hover:text-accent hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving
                  ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />
                }
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                title="Cancel editing"
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono text-text-muted hover:text-danger hover:bg-bg-elevated transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
          Loading unit file...
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-center gap-2 text-danger text-xs font-mono">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Read-only view */}
      {!loading && !error && unitInfo && !editing && (
        <pre className="font-mono text-xs text-text-primary bg-bg-surface border border-border rounded-md p-4 overflow-auto whitespace-pre-wrap flex-1">
          {unitInfo.content}
        </pre>
      )}

      {/* Edit view — CodeMirror */}
      {!loading && !error && unitInfo && editing && (
        <CodeMirror
          value={editContent}
          height="600px"
          theme="dark"
          extensions={[systemdLang]}
          onChange={(val) => setEditContent(val)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
          }}
          style={{ fontFamily: 'JetBrains Mono Variable, monospace', fontSize: '13px' }}
          className="border border-border rounded-md overflow-hidden"
        />
      )}
    </div>
  )
}

export default function UnitFile() {
  const { service } = useParams<{ service?: string }>()

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted font-mono">
        <p className="text-sm">Select a service to view its unit file.</p>
        <Link to="/" className="text-xs text-accent hover:underline">
          &larr; Back to Services
        </Link>
      </div>
    )
  }

  return <UnitFileViewer service={service} />
}
