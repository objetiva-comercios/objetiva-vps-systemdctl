import { runSystemctl } from './exec.js'

const SHOW_PROPS =
  'Id,Description,MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp,ActiveState,LoadState,SubState,UnitFileState'

/**
 * Parse `systemctl list-units --plain --no-legend` output.
 * Returns array of { unit, load, active, sub, description }.
 * Description is parts.slice(4).join(' ') — it contains spaces (Pitfall 3).
 *
 * @param {string} stdout
 * @returns {{ unit: string, load: string, active: string, sub: string, description: string }[]}
 */
export function parseListUnits(stdout) {
  return stdout
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        unit: parts[0],
        load: parts[1],
        active: parts[2],
        sub: parts[3],
        description: parts.slice(4).join(' '),
      }
    })
}

/**
 * Parse `systemctl show -p Key,...` output.
 * Blocks are separated by blank lines; each block is key=value lines.
 * Splits at first '=' only to handle values that contain '='.
 * Returns Map<Id, props>.
 *
 * @param {string} stdout
 * @returns {Map<string, Record<string, string>>}
 */
export function parseShowOutput(stdout) {
  const map = new Map()
  const blocks = stdout.trim().split('\n\n')
  for (const block of blocks) {
    const props = {}
    for (const line of block.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        props[line.slice(0, idx)] = line.slice(idx + 1)
      }
    }
    if (props.Id) {
      map.set(props.Id, props)
    }
  }
  return map
}

/**
 * Fetch all services with merged basic + detail data.
 * Runs list-units and show in parallel (Promise.all).
 * list-units is source of truth for the full list; show data fills in details.
 *
 * Guards:
 * - MemoryCurrent/CPUUsageNSec: '[not set]' -> null (Pitfall 1)
 * - ActiveEnterTimestamp: empty string -> null (Pitfall 2)
 * - MainPID: '0' -> null
 * - All numeric values parsed with parseInt()
 *
 * @returns {Promise<object[]>}
 */
export async function getAllServices() {
  const [listResult, showResult] = await Promise.all([
    runSystemctl('list-units', null, ['--all', '--type=service', '--plain', '--no-legend']),
    runSystemctl('show', null, ['--type=service', '-p', SHOW_PROPS]),
  ])

  const basicList = parseListUnits(listResult.stdout)
  const detailMap = parseShowOutput(showResult.stdout)

  return basicList.map(svc => {
    const detail = detailMap.get(svc.unit) ?? {}
    return {
      unit: svc.unit,
      load: detail.LoadState ?? svc.load,
      active: detail.ActiveState ?? svc.active,
      sub: detail.SubState ?? svc.sub,
      description: detail.Description ?? svc.description,
      unitFileState: detail.UnitFileState ?? '',
      pid: detail.MainPID && detail.MainPID !== '0' ? parseInt(detail.MainPID, 10) : null,
      memoryBytes:
        detail.MemoryCurrent && detail.MemoryCurrent !== '[not set]'
          ? parseInt(detail.MemoryCurrent, 10)
          : null,
      cpuNsec:
        detail.CPUUsageNSec && detail.CPUUsageNSec !== '[not set]'
          ? parseInt(detail.CPUUsageNSec, 10)
          : null,
      activeEnterTimestamp: detail.ActiveEnterTimestamp || null,
    }
  })
}
