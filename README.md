# systemdctl

Panel web auto-hospedado para gestionar servicios systemd en un VPS Linux. Permite visualizar el estado de todos los servicios, ejecutar acciones (start/stop/restart/enable/disable), leer logs de journalctl y editar archivos de unidad directamente desde el navegador. Diseñado para un administrador que quiere eliminar SSH de sus tareas rutinarias de gestión de servicios.

## Tecnologias

| Categoria | Tecnologia |
|-----------|-----------|
| Frontend | React 19, React Router 7, TypeScript 5.9 |
| Estilos | Tailwind CSS 4, JetBrains Mono |
| Editor | CodeMirror (sintaxis INI para unit files) |
| Backend | Node.js, Express 5 (ESM) |
| Base de datos | SQLite via better-sqlite3 (WAL mode) |
| Build | Vite 7, tsc |
| Infraestructura | systemd, Tailscale VPN |

## Requisitos previos

- Node.js >= 20
- npm
- Linux con systemd (Ubuntu 22.04+ / Debian 12+)
- Acceso sudo (necesario para acciones sobre servicios y edicion de unit files)
- Tailscale configurado (o ajustar `HOST` en `.env`)

## Instalacion

1. Clonar el repositorio:

```bash
git clone <url-del-repo> objetiva-vps-systemdctl
cd objetiva-vps-systemdctl
```

2. Instalar dependencias:

```bash
npm install
```

3. Copiar y configurar variables de entorno:

```bash
cp .env.example .env
```

4. Compilar el frontend:

```bash
npm run build
```

5. Iniciar el servidor:

```bash
npm start
```

## Configuracion

Variables de entorno en `.env`:

```env
PORT=7700
HOST=127.0.0.1
DB_PATH=./data/systemdctl.db
NODE_ENV=production
```

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `PORT` | `7700` | Puerto TCP del servidor |
| `HOST` | `127.0.0.1` | Direccion de bind. Usar IP de Tailscale para acceso VPN. Nunca `0.0.0.0` |
| `DB_PATH` | `./data/systemdctl.db` | Ruta al archivo SQLite (se crea automaticamente) |
| `NODE_ENV` | `development` | Entorno de ejecucion |

## Uso

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Inicia servidor y cliente en modo desarrollo (con hot reload) |
| `npm run dev:server` | Solo el servidor con `--watch` |
| `npm run dev:client` | Solo el cliente Vite |
| `npm run build` | Compila TypeScript y genera el bundle de produccion |
| `npm start` | Inicia el servidor en produccion (sirve `dist/`) |

## Arquitectura del proyecto

```
├── server/
│   ├── index.js              # Entry point Express, montaje de rutas, SPA catch-all
│   ├── config.js             # Carga de variables de entorno via dotenv
│   ├── db.js                 # Inicializacion SQLite, migracion de schema
│   ├── routes/
│   │   ├── services.js       # Listado de servicios y ejecucion de acciones
│   │   ├── system.js         # Hostname y uptime del sistema
│   │   ├── watched.js        # Servicios favoritos (CRUD SQLite)
│   │   ├── logs.js           # Logs de journalctl por servicio
│   │   └── unit.js           # Lectura y escritura de unit files
│   └── utils/
│       ├── exec.js           # Wrapper seguro de systemctl (execFile, whitelist)
│       └── systemctl.js      # Parsers de list-units y show
├── src/
│   ├── main.tsx              # Entry point React, BrowserRouter
│   ├── App.tsx               # Definicion de rutas
│   ├── index.css             # Tailwind + tema oscuro + JetBrains Mono
│   ├── components/
│   │   ├── Layout.tsx        # Shell con header + sidebar
│   │   ├── ServiceTable.tsx  # Tabla de servicios
│   │   ├── ServiceRow.tsx    # Fila por servicio con botones de accion
│   │   ├── SystemHeader.tsx  # Barra de hostname + uptime
│   │   └── SearchFilterBar.tsx # Busqueda y filtros por estado
│   ├── hooks/
│   │   └── useServicePolling.ts # Auto-polling cada 10s a /api/services
│   ├── pages/
│   │   ├── Home.tsx          # Dashboard principal
│   │   ├── Logs.tsx          # Visor de logs por servicio
│   │   ├── UnitFile.tsx      # Visor/editor de unit files con CodeMirror
│   │   └── ComingSoon.tsx    # Placeholder para rutas futuras
│   └── types/
│       ├── service.ts        # Interfaces y helpers de formato
│       ├── log.ts            # Interface de entrada de log
│       └── unit.ts           # Interface de unit file
├── data/                     # Base de datos SQLite (auto-generada)
├── dist/                     # Build de produccion (generado por Vite)
├── .env.example              # Plantilla de configuracion
└── package.json
```

## API / Endpoints

### Sistema

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/health` | Health check (`{ ok, timestamp }`) |
| GET | `/api/system` | Hostname y uptime del servidor |

### Servicios

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/services` | Lista todos los servicios systemd con estado, PID, memoria, CPU y uptime |
| POST | `/api/services/:name/action` | Ejecuta una accion: `start`, `stop`, `restart`, `enable`, `disable` |

### Favoritos

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/watched/:name` | Agrega servicio a favoritos |
| DELETE | `/api/watched/:name` | Elimina servicio de favoritos |

### Logs

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/logs/:service` | Logs de journalctl. Query params: `lines` (max 1000), `since` (5m/15m/1h/6h/1d/all) |

### Unit files

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/unit/:service` | Contenido del unit file, ruta y flag de escritura |
| PUT | `/api/unit/:service` | Escribe unit file (solo `/etc/systemd/system/`) y ejecuta daemon-reload |

## Seguridad

- Todos los comandos systemctl se ejecutan via `execFile` (sin shell) con una whitelist inmutable de acciones y validacion regex del nombre de servicio. Inyeccion de comandos es estructuralmente imposible.
- El servidor solo escucha en la IP configurada en `HOST`, nunca en `0.0.0.0`.
- La escritura de unit files usa archivo temporal + `sudo cp` + validacion de path contra traversal.
- Los logs estan limitados a 1000 lineas con timeout de 15 segundos.
