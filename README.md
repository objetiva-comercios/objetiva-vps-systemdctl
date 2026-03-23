# systemdctl

Panel web auto-hospedado para gestionar servicios systemd en un VPS Linux. Permite visualizar el estado de todos los servicios, ejecutar acciones (start/stop/restart/enable/disable), leer logs de journalctl y editar archivos de unidad -- todo desde el navegador, sin necesidad de abrir SSH.

Disenado para un administrador unico que gestiona entre 5 y 15 servicios en su propio servidor. Estetica de terminal oscura con foco en seguridad.

## Instalacion remota

```bash
curl -fsSL https://raw.githubusercontent.com/objetiva-comercios/objetiva-vps-systemdctl/main/install.sh | bash
```

## Tecnologias

| Categoria | Tecnologia |
|-----------|-----------|
| Frontend | React 19, React Router 7, TypeScript 5.9 |
| Estilos | Tailwind CSS 4, JetBrains Mono |
| Editor de codigo | CodeMirror 6 con sintaxis INI/systemd |
| Backend | Node.js 20+, Express 5 (ESM nativo) |
| Base de datos | SQLite via better-sqlite3 (WAL mode) |
| Build | Vite 7, tsc |
| Iconos | lucide-react |
| Infraestructura | systemd, Tailscale VPN |

## Requisitos previos

- **Node.js** >= 20 (recomendado 22 LTS)
- **npm**
- **Linux con systemd** -- Ubuntu 22.04+ / Debian 12+
- **Acceso root o sudo** -- necesario para ejecutar acciones sobre servicios y escribir unit files en `/etc/systemd/system/`
- **Tailscale** configurado en el VPS (o ajustar `HOST` en `.env` a `127.0.0.1` y usar un reverse proxy)

## Instalacion

1. Clonar el repositorio:

```bash
git clone <url-del-repo> systemdctl
cd systemdctl
```

2. Instalar dependencias:

```bash
npm install
```

3. Copiar y configurar variables de entorno:

```bash
cp .env.example .env
```

Editar `.env` con los valores adecuados para tu servidor (ver seccion Configuracion).

4. Compilar el frontend:

```bash
npm run build
```

5. Iniciar el servidor:

```bash
npm start
```

El panel estara disponible en `http://<HOST>:<PORT>` (por defecto `http://127.0.0.1:7700`).

Para ejecutar como servicio systemd permanente, consultar [INSTALL.md](INSTALL.md).

## Configuracion

Variables de entorno definidas en `.env`:

```env
PORT=7700
HOST=127.0.0.1
DB_PATH=./data/systemdctl.db
NODE_ENV=production
```

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `PORT` | `7700` | Puerto TCP en el que escucha el servidor |
| `HOST` | `127.0.0.1` | Direccion IP de bind. Usar la IP de Tailscale para acceso via VPN. Nunca usar `0.0.0.0` |
| `DB_PATH` | `./data/systemdctl.db` | Ruta al archivo SQLite. Se crea automaticamente junto con su directorio |
| `NODE_ENV` | `development` | Entorno de ejecucion. Usar `production` en el servidor |

La base de datos SQLite se inicializa automaticamente al primer arranque. No requiere migracion manual.

## Uso

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Inicia servidor y cliente en modo desarrollo con hot reload |
| `npm run dev:server` | Solo el servidor Express con `--watch` para recarga automatica |
| `npm run dev:client` | Solo el cliente Vite (puerto 5173, proxy de `/api` al puerto 7700) |
| `npm run build` | Compila TypeScript y genera el bundle de produccion en `dist/` |
| `npm start` | Inicia el servidor en produccion sirviendo los archivos estaticos de `dist/` |
| `npm run preview` | Previsualiza el build de produccion con Vite |

### Desarrollo

En desarrollo, el frontend corre en Vite (puerto 5173) con proxy automatico de las rutas `/api` al backend (puerto 7700). Ambos se inician juntos con `npm run dev`.

### Produccion

En produccion, un solo proceso Node.js sirve tanto la API como el frontend compilado:

```bash
npm run build && npm start
```

## Arquitectura del proyecto

```
server/
  index.js              Entry point Express, montaje de rutas, SPA catch-all
  config.js             Carga de variables de entorno via dotenv
  db.js                 Inicializacion SQLite con WAL mode y schema
  routes/
    services.js         Listado de servicios y ejecucion de acciones
    system.js           Hostname y uptime del sistema
    watched.js          Servicios favoritos (toggle en SQLite)
    logs.js             Logs de journalctl por servicio
    unit.js             Lectura y escritura de unit files
  utils/
    exec.js             Wrapper seguro de systemctl (execFile + whitelist)
    systemctl.js        Parsers de salida de list-units y show

src/
  main.tsx              Entry point React con BrowserRouter
  App.tsx               Definicion de rutas (Layout + paginas)
  index.css             Tailwind + tema oscuro + tipografia JetBrains Mono
  components/
    Layout.tsx          Shell con header, sidebar y Outlet
    SystemHeader.tsx    Barra con hostname y uptime del sistema
    ServiceTable.tsx    Contenedor de la tabla de servicios
    ServiceRow.tsx      Fila por servicio: estado, metricas, acciones, links
    SearchFilterBar.tsx Barra de busqueda y filtros por estado
  pages/
    Home.tsx            Dashboard principal con lista de servicios
    Logs.tsx            Visor de logs con filtros temporales y colores
    UnitFile.tsx        Visor/editor de unit files con CodeMirror
    ComingSoon.tsx      Placeholder para rutas futuras
  hooks/
    useServicePolling.ts  Hook de auto-polling cada 10s
  types/
    service.ts          Interfaces ServiceEntry, SystemInfo y helpers de formato
    log.ts              Interface LogEntry
    unit.ts             Interface UnitFileInfo

data/                   Base de datos SQLite (auto-generada, ignorada en git)
dist/                   Build de produccion (generado por Vite)
.env.example            Plantilla de configuracion
INSTALL.md              Guia de instalacion como servicio systemd
```

## API / Endpoints

### Sistema

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/health` | Health check -- retorna `{ ok, timestamp }` |
| GET | `/api/system` | Hostname y uptime del servidor en segundos |

### Servicios

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/services` | Lista todos los servicios systemd con estado, sub-estado, PID, memoria, CPU, uptime, path del unit file y flag `writable` |
| POST | `/api/services/:name/action` | Ejecuta una accion sobre el servicio. Body: `{ "action": "start" | "stop" | "restart" | "enable" | "disable" }` |

### Favoritos

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/watched/:name` | Marca un servicio como favorito |
| DELETE | `/api/watched/:name` | Elimina un servicio de favoritos |

### Logs

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/logs/:service` | Logs de journalctl en formato estructurado. Query params: `lines` (1-1000, default 100), `since` (`5m` / `15m` / `1h` / `6h` / `1d` / `all`) |

### Unit files

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/unit/:service` | Contenido del unit file, ruta resuelta y flag `writable`. Lee de 4 paths de systemd |
| PUT | `/api/unit/:service` | Escribe el unit file (solo en `/etc/systemd/system/`) y ejecuta `daemon-reload` automaticamente. Body: `{ "content": "..." }` |

## Seguridad

- **Sin inyeccion de comandos** -- Todos los comandos systemctl se ejecutan via `execFile` (sin shell) con una whitelist inmutable (`Object.freeze`) de acciones permitidas y validacion regex estricta (`/^[\w@\-.]+$/`) del nombre de servicio antes de cualquier llamada.
- **Bind restringido** -- El servidor solo escucha en la IP configurada en `HOST` (por defecto `127.0.0.1`). Nunca se expone en `0.0.0.0`.
- **Escritura segura de unit files** -- Archivo temporal en `/tmp` + `sudo cp` al destino + `sudo chmod 0644`. La ruta se valida con `path.resolve()` contra prefijos permitidos para prevenir traversal (`../`).
- **Lectura controlada** -- Los unit files solo se leen de 4 directorios de systemd conocidos. La escritura esta restringida exclusivamente a `/etc/systemd/system/`.
- **Limites de recursos** -- Logs limitados a 1000 lineas con timeout de 15s. Comandos systemctl con timeout de 30s. Buffers de salida limitados a 5 MB. Contenido de unit files limitado a 1 MB.
- **Sin autenticacion en v1** -- El panel se accede exclusivamente a traves de Tailscale VPN. La autenticacion con JWT esta planificada para v2.

## Deploy

La instalacion en produccion esta documentada en [INSTALL.md](INSTALL.md). Cubre:

- Compilacion del frontend
- Configuracion de variables de entorno
- Creacion del servicio systemd
- Habilitacion e inicio del servicio
- Comandos de mantenimiento
- Desinstalacion

Despliegue minimo:

```bash
npm install && npm run build && node server/index.js
```

## Estado del proyecto

**v1.0 MVP -- completado** (2026-03-23)

- 6 fases, 12 planes ejecutados
- 23/23 requisitos de v1 satisfechos
- 1.935 lineas de codigo (JS/TS)

Funcionalidades entregadas:

- Dashboard de servicios con metricas de salud y auto-polling cada 10 segundos
- Control completo de servicios (start/stop/restart/enable/disable) con actualizaciones optimistas
- Busqueda, filtrado por estado y servicios favoritos con persistencia en SQLite
- Visor de logs por servicio con filtrado temporal y severidad con colores
- Editor de unit files con CodeMirror, syntax highlighting y guardado atomico con daemon-reload
- Estetica de terminal oscura (#0a0e14 / #22c55e / JetBrains Mono)

### Proximos pasos (v2)

- Autenticacion JWT con login y refresh
- Control de acceso basado en roles (admin, operador, visor)
- Streaming de logs en tiempo real via WebSocket
- Dialogos de confirmacion para acciones destructivas
- Atajos de teclado
- Layout responsive para tablet
