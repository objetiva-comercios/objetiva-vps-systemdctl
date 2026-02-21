export interface UnitFileInfo {
  service: string
  path: string        // FragmentPath from systemctl show
  content: string     // Full text of the unit file
  writable: boolean   // true only if path is under /etc/systemd/system/
}
