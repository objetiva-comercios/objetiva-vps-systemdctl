# Deploy — systemdctl

Panel web para administrar servicios systemd en un VPS Linux.

---

## Requisitos del servidor

| Componente | Version minima |
|------------|---------------|
| OS | Ubuntu 22.04+ / Debian 12+ |
| Node.js | >= 20.0.0 (recomendado 22.x LTS) |
| npm | >= 10 |
| systemd | Presente (default en Ubuntu/Debian) |
| Git | Cualquiera |

El servidor corre como **root** para tener acceso directo a `systemctl` y `journalctl`.

---

## Arquitectura de deploy

```
┌────────────────────────────────────────┐
│  VPS (Ubuntu/Debian)                   │
│                                        │
│  systemdctl.service (systemd unit)     │
│    └─ node server/index.js             │
│         ├─ Express 5 API (:7700)       │
│         ├─ React SPA (dist/)           │
│         └─ SQLite (data/systemdctl.db) │
│                                        │
│  Bind: 127.0.0.1:7700                  │
│  Acceso: Tailscale VPN                 │
└────────────────────────────────────────┘
```

- **Sin Docker** — corre directamente como servicio systemd
- **Sin Traefik / nginx** — acceso directo via Tailscale VPN
- **Sin autenticacion** — protegido por la red VPN

---

## Variables de entorno

Archivo `.env` en la raiz del proyecto:

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `PORT` | `7700` | Puerto del servidor |
| `HOST` | `127.0.0.1` | IP de bind. Usar IP de Tailscale para acceso VPN |
| `DB_PATH` | `./data/systemdctl.db` | Ruta a la base de datos SQLite |
| `NODE_ENV` | `development` | Usar `production` en deploy |

Ejemplo para produccion:

```env
PORT=7700
HOST=100.87.113.34
DB_PATH=./data/systemdctl.db
NODE_ENV=production
```

> **IMPORTANTE:** Nunca usar `0.0.0.0` como HOST. El servidor solo debe ser accesible via Tailscale.

---

## Instalacion rapida (script automatico)

```bash
curl -fsSL https://raw.githubusercontent.com/objetiva-comercios/objetiva-vps-systemdctl/master/install.sh | bash
```

O clonar y ejecutar manualmente:

```bash
git clone https://github.com/objetiva-comercios/objetiva-vps-systemdctl.git /opt/systemdctl
cd /opt/systemdctl
bash install.sh
```

---

## Instalacion manual paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/objetiva-comercios/objetiva-vps-systemdctl.git /opt/systemdctl
cd /opt/systemdctl
```

### 2. Instalar dependencias y compilar

```bash
npm install
npm run build
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores de produccion:

```bash
PORT=7700
HOST=100.87.113.34
DB_PATH=./data/systemdctl.db
NODE_ENV=production
```

### 4. Crear el servicio systemd

Crear `/etc/systemd/system/systemdctl.service`:

```ini
[Unit]
Description=systemdctl — Panel web para servicios systemd
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/systemdctl
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/systemdctl/.env

[Install]
WantedBy=multi-user.target
```

### 5. Habilitar y arrancar

```bash
systemctl daemon-reload
systemctl enable systemdctl
systemctl start systemdctl
```

### 6. Verificar

```bash
systemctl status systemdctl
curl -s http://127.0.0.1:7700/api/health
```

Respuesta esperada:

```json
{"ok":true,"timestamp":"2026-03-23T..."}
```

---

## Actualizacion

```bash
cd /opt/systemdctl
git pull origin main
npm install
npm run build
systemctl restart systemdctl
```

---

## Logs del servicio

```bash
# Ultimas 50 lineas
journalctl -u systemdctl -n 50 --no-pager

# Seguir en tiempo real
journalctl -u systemdctl -f

# Desde hoy
journalctl -u systemdctl --since today
```

---

## Healthcheck

```bash
curl -s http://127.0.0.1:7700/api/health | jq .
```

Para monitoreo automatico, agregar un timer o cron:

```bash
# Cada 5 minutos, reiniciar si no responde
*/5 * * * * curl -sf http://127.0.0.1:7700/api/health > /dev/null || systemctl restart systemdctl
```

---

## Desinstalacion

```bash
systemctl stop systemdctl
systemctl disable systemdctl
rm /etc/systemd/system/systemdctl.service
systemctl daemon-reload
rm -rf /opt/systemdctl
```

---

## Notas de seguridad

- El servidor corre como **root** — necesario para ejecutar `systemctl` y `journalctl` sin sudo
- Bind exclusivo a `127.0.0.1` o IP de Tailscale — **nunca** exponer a internet
- Sin autenticacion en v1 — la seguridad depende de Tailscale VPN
- Todos los comandos ejecutados via `execFile` con whitelist de acciones permitidas
- Nombres de servicio validados con regex estricta (`/^[\w@\-.]+$/`)
