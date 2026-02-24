# PRD: systemdctl — Panel de Administración de Servicios systemd

> Documento de requisitos de producto para construir con Claude Code.
> Última actualización: 2026-02-19

---

## 1. Resumen Ejecutivo

**systemdctl** es un panel web self-hosted para administrar servicios systemd en un VPS Linux. Permite visualizar, monitorear, controlar y editar servicios desde una interfaz web segura, eliminando la necesidad de acceso SSH para operaciones rutinarias de administración de procesos.

**Stack tecnológico:**
- **Backend:** Node.js + Express
- **Frontend:** React (Vite) con Tailwind CSS
- **Base de datos:** SQLite (para configuración, usuarios y auditoría)
- **Comunicación:** REST API + WebSocket (para logs en tiempo real)
- **Auth:** JWT con bcrypt
- **Target OS:** Ubuntu 22.04+ / Debian 12+

---

## 2. Problema

Administrar servicios en un VPS requiere acceso SSH y memorizar comandos systemctl/journalctl. Para alguien que maneja múltiples proyectos y servicios, esto es:

- Lento: hay que conectarse por SSH cada vez
- Propenso a errores: un typo en un comando puede causar downtime
- Sin visibilidad: no hay un dashboard centralizado del estado de todo
- Sin historial: no queda registro de quién hizo qué cambio y cuándo

---

## 3. Objetivos

1. Ver todos los servicios systemd en un dashboard con estado en tiempo real
2. Ejecutar acciones (start, stop, restart, enable, disable) desde la UI
3. Ver y hacer streaming de logs (journalctl) en tiempo real
4. Editar unit files (.service) desde un editor integrado con syntax highlighting
5. Crear nuevos unit files desde la UI con templates predefinidos
6. Registro de auditoría de todas las acciones realizadas
7. Autenticación segura con soporte multi-usuario
8. Notificaciones cuando un servicio cambia de estado inesperadamente

---

## 4. Arquitectura

```
┌─────────────────────────────────────────────────┐
│                    NGINX                         │
│            (reverse proxy + SSL)                 │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              Node.js Server                      │
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  REST API   │  │ WebSocket  │  │  Auth      │  │
│  │  /api/*     │  │ /ws/logs   │  │  JWT+bcrypt│  │
│  └─────┬──────┘  └─────┬──────┘  └───────────┘  │
│        │               │                         │
│  ┌─────▼───────────────▼──────────────────────┐  │
│  │         Service Layer                       │  │
│  │  - SystemdService (systemctl wrapper)       │  │
│  │  - LogService (journalctl streaming)        │  │
│  │  - UnitFileService (read/write/validate)    │  │
│  │  - AuditService (action logging)            │  │
│  │  - MonitorService (state change detection)  │  │
│  └─────┬──────────────────────────────────────┘  │
│        │                                         │
│  ┌─────▼──────┐  ┌────────────────────────────┐  │
│  │   SQLite    │  │  systemd (systemctl,       │  │
│  │  - users    │  │  journalctl, unit files)   │  │
│  │  - audit    │  │                            │  │
│  │  - config   │  │                            │  │
│  └────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              React Frontend (SPA)                │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │Dashboard │ │ Service  │ │  Unit File      │  │
│  │ (list)   │ │ Detail   │ │  Editor         │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Log      │ │ Audit    │ │  Settings /     │  │
│  │ Viewer   │ │ Log      │ │  Users          │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 5. Estructura del Proyecto

```
systemdctl/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── .env.example
├── README.md
│
├── server/
│   ├── index.js                  # Entry point, Express + WS setup
│   ├── config.js                 # Env vars, defaults
│   ├── db.js                     # SQLite setup + migrations
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT verification middleware
│   │   ├── audit.js              # Logs every mutating action
│   │   └── rateLimit.js          # Rate limiting
│   │
│   ├── routes/
│   │   ├── auth.routes.js        # POST /api/auth/login, /api/auth/refresh
│   │   ├── services.routes.js    # GET/POST /api/services/*
│   │   ├── logs.routes.js        # GET /api/logs/:name, WS upgrade
│   │   ├── units.routes.js       # GET/PUT/POST/DELETE /api/units/:name
│   │   ├── audit.routes.js       # GET /api/audit
│   │   └── users.routes.js       # CRUD /api/users (admin only)
│   │
│   ├── services/
│   │   ├── systemd.service.js    # Wrapper around systemctl commands
│   │   ├── log.service.js        # journalctl reader + streaming
│   │   ├── unitfile.service.js   # Read/write/validate unit files
│   │   ├── audit.service.js      # Write audit entries to SQLite
│   │   └── monitor.service.js    # Poll for state changes, emit events
│   │
│   └── utils/
│       ├── sanitize.js           # Input sanitization for service names
│       └── exec.js               # Safe child_process wrapper
│
├── src/                          # React frontend
│   ├── main.jsx
│   ├── App.jsx                   # Router + layout
│   ├── api.js                    # Axios/fetch wrapper with JWT
│   │
│   ├── components/
│   │   ├── Layout.jsx            # Sidebar + header shell
│   │   ├── ServiceList.jsx       # Main service table/grid
│   │   ├── ServiceCard.jsx       # Individual service row/card
│   │   ├── ServiceDetail.jsx     # Full detail panel (tabs)
│   │   ├── LogViewer.jsx         # Streaming log viewer
│   │   ├── UnitEditor.jsx        # Code editor for .service files
│   │   ├── ActionBar.jsx         # Start/stop/restart/enable buttons
│   │   ├── StatusBadge.jsx       # Colored status indicators
│   │   ├── AuditLog.jsx          # Audit trail viewer
│   │   ├── CreateServiceModal.jsx# New unit file wizard
│   │   ├── Toast.jsx             # Notification toasts
│   │   └── ConfirmDialog.jsx     # Confirmation for destructive actions
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx         # Main dashboard view
│   │   ├── Login.jsx             # Login page
│   │   ├── Audit.jsx             # Full audit log page
│   │   └── Settings.jsx          # User management + config
│   │
│   ├── hooks/
│   │   ├── useServices.js        # Fetch + poll services
│   │   ├── useWebSocket.js       # WS connection for logs
│   │   └── useAuth.js            # Auth state + token refresh
│   │
│   └── utils/
│       └── constants.js
│
└── public/
    └── favicon.svg
```

---

## 6. Diseño de la API

### 6.1 Autenticación

```
POST   /api/auth/login          { username, password } → { token, refreshToken }
POST   /api/auth/refresh        { refreshToken }       → { token }
```

- JWT con expiración de 1 hora
- Refresh token con expiración de 7 días
- Passwords hasheados con bcrypt (salt rounds: 12)

### 6.2 Servicios

```
GET    /api/services                    → Lista de todos los servicios con estado
GET    /api/services/:name              → Detalle de un servicio específico
POST   /api/services/:name/action       { action: "start"|"stop"|"restart"|"enable"|"disable" }
```

**Respuesta de GET /api/services:**
```json
{
  "hostname": "my-vps",
  "uptime": "14d 3h 22m",
  "services": [
    {
      "name": "nginx.service",
      "description": "A high performance web server",
      "loadState": "loaded",
      "activeState": "active",
      "subState": "running",
      "enabled": true,
      "pid": 1234,
      "memory": "12.4M",
      "cpu": "0.1s",
      "uptime": "14d 3h 20m",
      "unitFilePath": "/etc/systemd/system/nginx.service"
    }
  ]
}
```

### 6.3 Logs

```
GET    /api/logs/:name?lines=100&since=2h   → Últimas N líneas de logs
WS     /ws/logs/:name                        → Stream de logs en tiempo real
```

**WebSocket protocol:**
- Cliente envía: `{ "service": "nginx.service", "lines": 50 }`
- Server envía: `{ "type": "log", "line": "feb 19 08:00:01 ...", "timestamp": "..." }`
- Server envía: `{ "type": "error", "message": "..." }`
- Heartbeat cada 30s: `{ "type": "ping" }`

### 6.4 Unit Files

```
GET    /api/units/:name                → { content, path }
PUT    /api/units/:name                { content } → Guarda + daemon-reload
POST   /api/units                      { name, content } → Crea nuevo unit file
DELETE /api/units/:name                → Elimina unit file + daemon-reload
GET    /api/units/templates            → Lista de templates predefinidos
```

**Templates disponibles (GET /api/units/templates):**
```json
[
  {
    "id": "node-app",
    "name": "Node.js Application",
    "template": "[Unit]\nDescription={{description}}\nAfter=network.target\n\n[Service]\nType=simple\nUser={{user}}\nWorkingDirectory={{workdir}}\nExecStart=/usr/bin/node {{entrypoint}}\nRestart=on-failure\nRestartSec=5\nEnvironment=NODE_ENV=production\nEnvironment=PORT={{port}}\n\n[Install]\nWantedBy=multi-user.target",
    "variables": ["description", "user", "workdir", "entrypoint", "port"]
  },
  {
    "id": "python-app",
    "name": "Python Application",
    "template": "...",
    "variables": ["description", "user", "workdir", "entrypoint"]
  },
  {
    "id": "docker-compose",
    "name": "Docker Compose Project",
    "template": "...",
    "variables": ["description", "workdir"]
  },
  {
    "id": "generic",
    "name": "Generic Service",
    "template": "...",
    "variables": ["description", "user", "execstart"]
  }
]
```

### 6.5 Auditoría

```
GET    /api/audit?page=1&limit=50&service=nginx   → Log de auditoría paginado
```

**Registro de auditoría:**
```json
{
  "id": 1,
  "timestamp": "2026-02-19T15:30:00Z",
  "user": "admin",
  "action": "restart",
  "service": "my-app.service",
  "details": "Manual restart from dashboard",
  "ip": "192.168.1.100",
  "result": "success"
}
```

### 6.6 Usuarios (solo admin)

```
GET    /api/users                        → Lista de usuarios
POST   /api/users                        { username, password, role }
PUT    /api/users/:id                    { password?, role? }
DELETE /api/users/:id
```

**Roles:**
- `admin`: Control total, gestión de usuarios
- `operator`: Puede ver, start/stop/restart, ver logs
- `viewer`: Solo lectura (ver estado y logs)

---

## 7. Base de Datos (SQLite)

### 7.1 Schema

```sql
-- Usuarios
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','operator','viewer')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Audit log
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  service TEXT,
  details TEXT,
  ip_address TEXT,
  result TEXT NOT NULL DEFAULT 'success' CHECK(result IN ('success','failure')),
  error_message TEXT
);

-- Configuración general
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Servicios marcados como favoritos / monitoreados
CREATE TABLE watched_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  service_name TEXT NOT NULL,
  notify_on_change BOOLEAN DEFAULT 1,
  UNIQUE(user_id, service_name)
);

-- Índices
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_service ON audit_log(service);
CREATE INDEX idx_audit_user ON audit_log(username);
```

### 7.2 Seed inicial

Al primer arranque, si no existen usuarios, crear:
- Usuario `admin` con password generado aleatoriamente
- Imprimir el password en la consola del server UNA sola vez
- Forzar cambio de password en el primer login

---

## 8. Diseño del Frontend

### 8.1 Estética y Dirección Visual

**Concepto:** Terminal moderna — dark theme con acentos verdes. Estética de centro de control/monitoreo.

**Paleta de colores:**
```
Background principal:    #0a0e14
Background secundario:   #0f1319
Background elevado:      #151b23
Bordes:                  #1e293b
Texto principal:         #e2e8f0
Texto secundario:        #64748b
Acento primario (verde): #22c55e
Warning (amber):         #f59e0b
Error (rojo):            #ef4444
Info (azul):             #3b82f6
```

**Tipografía:**
- Font principal: `JetBrains Mono` (monoespaciado para data y logs)
- Font secundaria: `Inter` para textos largos si se necesitan
- Tamaños: 11px para datos, 12px para labels, 14px para títulos de sección

**Iconografía:** Usar `lucide-react` para todos los iconos. No emojis como iconos funcionales.

### 8.2 Layout Principal

```
┌──────────────────────────────────────────────────────────┐
│  HEADER: logo + hostname + system stats + user menu      │
├────────┬─────────────────────────────────────────────────┤
│        │                                                  │
│  SIDE  │   CONTENT AREA                                   │
│  BAR   │                                                  │
│        │   ┌─────────────────────────────────────────┐    │
│  nav   │   │  Filters + Search                       │    │
│  links │   ├─────────────────────────────────────────┤    │
│        │   │                                         │    │
│  • All │   │  Service List / Grid                    │    │
│  • Run │   │                                         │    │
│  • Stop│   │  Cada fila muestra:                     │    │
│  • Fav │   │  - Status dot (color)                   │    │
│        │   │  - Nombre del servicio                  │    │
│  ───── │   │  - Descripción                          │    │
│        │   │  - SubState badge                       │    │
│  Audit │   │  - Enabled/Disabled badge               │    │
│  Users │   │  - PID | Memory | CPU                   │    │
│  Config│   │  - Quick actions (iconos)               │    │
│        │   │                                         │    │
│        │   └─────────────────────────────────────────┘    │
│        │                                                  │
└────────┴─────────────────────────────────────────────────┘
```

### 8.3 Panel de Detalle de Servicio

Al hacer click en un servicio, se abre un panel lateral derecho (slide-in) o una vista expandida con pestañas:

**Tab: Overview**
- Estado actual con indicador visual grande
- Stats: PID, Memory, CPU, Uptime, Restart count
- Barra de acciones: Start, Stop, Restart, Enable, Disable
- Quick info: path del unit file, user, working directory

**Tab: Logs**
- Viewer de logs con scroll infinito hacia arriba
- Streaming en tiempo real via WebSocket
- Botón de pause/resume del stream
- Search/filter dentro de los logs
- Selector de rango temporal (últimos 5m, 15m, 1h, 6h, 1d)
- Botón para descargar logs como .txt
- Coloreado de líneas: errores en rojo, warnings en amber

**Tab: Unit File**
- Editor de código con syntax highlighting para formato INI/systemd
- Indicador de cambios sin guardar
- Botón "Save & Reload Daemon" (systemctl daemon-reload)
- Botón "Revert" para descartar cambios
- Validación básica de sintaxis antes de guardar

**Tab: Audit**
- Historial de acciones sobre este servicio específico
- Quién, cuándo, qué acción, resultado

### 8.4 Modal de Crear Servicio

- Paso 1: Seleccionar template (Node.js, Python, Docker Compose, Generic)
- Paso 2: Llenar variables del template (nombre, descripción, user, working directory, etc.)
- Paso 3: Preview del unit file generado, con opción de editar manualmente
- Paso 4: Confirmar nombre del archivo y crear
- Auto-enable y start opcionales después de crear

### 8.5 Página de Audit Log

- Tabla paginada con filtros por: usuario, servicio, acción, rango de fechas, resultado
- Exportar como CSV
- Timeline visual de eventos

### 8.6 Login

- Pantalla simple y centrada con el branding del proyecto
- Campo de usuario y password
- Mensaje de error inline (no alerts)
- Redirect a dashboard después de login exitoso

### 8.7 Interacciones y UX

- **Confirmación para acciones destructivas:** Stop y Disable requieren confirmación en un dialog
- **Toast notifications:** Feedback de cada acción (éxito/error) en toast esquina superior derecha, auto-dismiss en 4 segundos
- **Polling:** Refrescar lista de servicios cada 10 segundos (configurable)
- **Responsive:** Funcional en tablet. En mobile, sidebar se colapsa a hamburger menu
- **Keyboard shortcuts:**
  - `/` para focus en search
  - `r` para refresh
  - `Esc` para cerrar panel de detalle
- **Empty states:** Mensajes útiles cuando no hay servicios que coincidan con el filtro

---

## 9. Seguridad

### 9.1 Autenticación y Autorización

- JWT tokens firmados con secret aleatorio generado al instalar (guardado en config de SQLite o .env)
- Refresh tokens almacenados en httpOnly cookie
- Rate limiting: 5 intentos de login fallidos → bloqueo de 15 minutos por IP
- Todas las rutas /api/* requieren JWT válido excepto /api/auth/login y /api/auth/refresh
- Middleware de autorización que verifica el rol del usuario para cada endpoint

**Matriz de permisos:**

| Endpoint | admin | operator | viewer |
|---|---|---|---|
| GET /api/services | ✓ | ✓ | ✓ |
| POST /api/services/:name/action | ✓ | ✓ | ✗ |
| GET /api/logs | ✓ | ✓ | ✓ |
| GET /api/units/:name | ✓ | ✓ | ✓ |
| PUT /api/units/:name | ✓ | ✗ | ✗ |
| POST /api/units (crear) | ✓ | ✗ | ✗ |
| DELETE /api/units (eliminar) | ✓ | ✗ | ✗ |
| GET /api/audit | ✓ | ✓ | ✗ |
| /api/users/* | ✓ | ✗ | ✗ |

### 9.2 Sanitización de Input

- Nombres de servicio: regex `/^[\w@\-.]+$/` — rechazar cualquier otra cosa
- Contenido de unit files: validar que sea texto plano, no binario
- Parámetro `lines` para logs: parseInt + clamp entre 1 y 1000
- Parámetro `since` para logs: validar formato (e.g., "2h", "1d", "2026-02-19")

### 9.3 Ejecución de Comandos

- NUNCA construir comandos con concatenación de strings del usuario
- Usar un whitelist de acciones permitidas: `["start", "stop", "restart", "enable", "disable"]`
- Ejecutar con `execFile` en vez de `exec` cuando sea posible
- Timeout de 30 segundos para cualquier comando
- Loggear cada comando ejecutado en audit log

### 9.4 Red

- El server debe escuchar solo en `127.0.0.1` por defecto
- Acceso externo SOLO vía reverse proxy (nginx/caddy) con SSL
- Headers de seguridad: `helmet` middleware
- CORS restringido al dominio configurado

---

## 10. Configuración y Variables de Entorno

```env
# .env.example

# Server
PORT=7700
HOST=127.0.0.1
NODE_ENV=production

# Auth
JWT_SECRET=           # auto-generado si no se provee
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Database
DB_PATH=./data/systemdctl.db

# Monitoring
POLL_INTERVAL=10000   # ms entre polls de estado
LOG_STREAM_LINES=100  # líneas iniciales al abrir log stream

# Security
RATE_LIMIT_WINDOW=900000    # 15 min en ms
RATE_LIMIT_MAX_ATTEMPTS=5
ALLOWED_ORIGINS=https://panel.tudominio.com

# Optional
SUDO_PREFIX=sudo      # dejar vacío si se ejecuta como root
```

---

## 11. Deployment

### 11.1 Instalación

```bash
# Clonar e instalar
git clone <repo> /opt/systemdctl
cd /opt/systemdctl
npm install

# Configurar
cp .env.example .env
# Editar .env con tu configuración

# Build del frontend
npm run build

# Inicializar DB y primer usuario
node server/index.js --init

# Ejecutar
sudo node server/index.js
```

### 11.2 Systemd Unit File (meta: se administra a sí mismo)

```ini
[Unit]
Description=systemdctl Dashboard
After=network.target
Documentation=https://github.com/tu-usuario/systemdctl

[Service]
Type=simple
User=root
WorkingDirectory=/opt/systemdctl
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/systemdctl/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=systemdctl

[Install]
WantedBy=multi-user.target
```

### 11.3 Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name panel.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/panel.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.tudominio.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://127.0.0.1:7700;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support para log streaming
    location /ws/ {
        proxy_pass http://127.0.0.1:7700;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

---

## 12. Fases de Desarrollo

### Fase 1 — MVP (Core funcional)
- [ ] Setup del proyecto (Vite + Express + SQLite)
- [ ] Backend: listar servicios, obtener estado detallado
- [ ] Backend: ejecutar acciones (start/stop/restart/enable/disable)
- [ ] Backend: leer logs (journalctl)
- [ ] Backend: leer unit files
- [ ] Frontend: dashboard con lista de servicios y estados
- [ ] Frontend: panel de detalle con tabs (overview, logs, unit file)
- [ ] Frontend: barra de acciones funcional
- [ ] Auth: login básico con JWT (un solo usuario admin)

### Fase 2 — Edición y Creación
- [ ] Backend: escribir unit files + daemon-reload
- [ ] Backend: crear nuevos unit files desde templates
- [ ] Backend: eliminar unit files
- [ ] Frontend: editor de unit files con syntax highlighting
- [ ] Frontend: modal de creación de servicio con wizard
- [ ] Frontend: confirmación para acciones destructivas
- [ ] Validación de unit files antes de guardar

### Fase 3 — Tiempo Real y Auditoría
- [ ] WebSocket para streaming de logs en tiempo real
- [ ] Backend: audit log de todas las acciones
- [ ] Frontend: log viewer con streaming, search, y filtro temporal
- [ ] Frontend: página de audit log con filtros y paginación
- [ ] Polling automático del estado de servicios

### Fase 4 — Multi-usuario y Monitoreo
- [ ] Roles (admin, operator, viewer) con permisos granulares
- [ ] CRUD de usuarios desde la UI
- [ ] Watched services: marcar servicios como favoritos
- [ ] Monitor: detectar cambios de estado inesperados
- [ ] Notificaciones en la UI cuando un servicio se cae
- [ ] Export de audit log como CSV

### Fase 5 — Polish
- [ ] Keyboard shortcuts
- [ ] Responsive design (tablet)
- [ ] Empty states y error states bonitos
- [ ] Coloreado inteligente de logs (errores, warnings)
- [ ] Animaciones y transiciones
- [ ] Dark/light theme toggle (opcional)
- [ ] Documentación de la API

---

## 13. Criterios de Aceptación

1. **El dashboard carga en < 2 segundos** y muestra el estado correcto de todos los servicios
2. **Las acciones (start/stop/restart) se ejecutan en < 3 segundos** y la UI refleja el cambio
3. **Los logs se ven en tiempo real** sin delay perceptible (< 500ms)
4. **Editar un unit file y guardar** ejecuta daemon-reload automáticamente
5. **Crear un nuevo servicio** desde un template funciona end-to-end
6. **Toda acción queda registrada** en el audit log con usuario, timestamp, y resultado
7. **Un usuario viewer NO puede** ejecutar acciones ni editar archivos
8. **El login bloquea después de 5 intentos fallidos** por 15 minutos
9. **Sin acceso SSH**, un admin puede gestionar completamente sus servicios
10. **El panel se auto-administra**: aparece en su propia lista de servicios

---

## 14. Notas para Claude Code

- Empezar por la Fase 1. Cada fase debe dejar el proyecto funcional y desplegable.
- Usar `better-sqlite3` para SQLite (síncrono, más simple que async).
- Usar `ws` para WebSockets (no socket.io, es más liviano).
- Para syntax highlighting en el editor de unit files, usar `@codemirror/lang-json` o un highlighter simple custom para formato INI.
- El frontend debe poder funcionar en "modo demo" con datos estáticos cuando no hay backend conectado (para desarrollo y preview).
- Cada endpoint del backend debe tener validación de input explícita, no confiar en el frontend.
- Los comandos systemctl se ejecutan con un wrapper que sanitiza, loggea, y maneja timeouts.
- El proyecto debe poder instalarse y arrancar con `npm install && npm run build && sudo node server/index.js` sin pasos extra.
