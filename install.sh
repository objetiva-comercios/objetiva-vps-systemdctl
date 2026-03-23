#!/usr/bin/env bash
# ============================================================================
# install.sh — Instalador automatico de systemdctl
# Panel web para administrar servicios systemd en un VPS Linux
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/objetiva-comercios/objetiva-vps-systemdctl/main/install.sh | sudo bash
#   o bien:
#   git clone <repo> /opt/systemdctl && cd /opt/systemdctl && sudo bash install.sh
# ============================================================================

set -euo pipefail

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Configuracion ---
REPO_URL="https://github.com/objetiva-comercios/objetiva-vps-systemdctl.git"
INSTALL_DIR="/opt/systemdctl"
SERVICE_NAME="systemdctl"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_MIN_VERSION=20
DEFAULT_PORT=7700
DEFAULT_HOST="127.0.0.1"

# --- Funciones auxiliares ---
log()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

check_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Este script debe ejecutarse como root."
    err "Ejecutar: sudo bash install.sh"
    exit 1
  fi
}

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    err "No se pudo detectar el sistema operativo."
    exit 1
  fi
  source /etc/os-release
  case "$ID" in
    ubuntu|debian) log "Sistema operativo: $PRETTY_NAME" ;;
    *) warn "SO no testeado: $PRETTY_NAME. Continuando igualmente..." ;;
  esac
}

install_node() {
  info "Instalando Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  if command -v node &>/dev/null; then
    log "Node.js $(node -v) instalado"
  else
    err "No se pudo instalar Node.js automaticamente."
    err "Instalar manualmente: https://nodejs.org/"
    exit 1
  fi
}

check_node() {
  if ! command -v node &>/dev/null; then
    warn "Node.js no esta instalado."
    install_node
    return
  fi

  local node_version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if (( node_version < NODE_MIN_VERSION )); then
    warn "Node.js >= ${NODE_MIN_VERSION} requerido. Version actual: $(node -v)"
    info "Actualizando Node.js..."
    install_node
    return
  fi
  log "Node.js $(node -v) detectado"
}

check_npm() {
  if ! command -v npm &>/dev/null; then
    warn "npm no esta instalado. Instalando..."
    apt-get install -y -qq npm >/dev/null 2>&1
    if ! command -v npm &>/dev/null; then
      err "No se pudo instalar npm."
      exit 1
    fi
  fi
  log "npm $(npm -v) detectado"
}

check_git() {
  if ! command -v git &>/dev/null; then
    info "Instalando git..."
    apt-get update -qq && apt-get install -y -qq git
  fi
  log "git $(git --version | cut -d' ' -f3) detectado"
}

check_systemd() {
  if ! command -v systemctl &>/dev/null; then
    err "systemd no esta disponible en este sistema."
    exit 1
  fi
  log "systemd detectado"
}

# --- Clonar o actualizar repositorio ---
clone_or_update() {
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    info "Directorio ${INSTALL_DIR} ya existe. Actualizando..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard origin/main
    log "Repositorio actualizado"
  else
    info "Clonando repositorio en ${INSTALL_DIR}..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    log "Repositorio clonado en ${INSTALL_DIR}"
  fi
  cd "$INSTALL_DIR"
}

# --- Instalar dependencias y compilar ---
build_project() {
  info "Instalando dependencias (npm install)..."
  npm install --production=false 2>&1 | tail -1
  log "Dependencias instaladas"

  info "Compilando frontend (npm run build)..."
  npm run build 2>&1 | tail -3
  log "Frontend compilado"
}

# --- Configurar .env ---
setup_env() {
  if [[ -f "${INSTALL_DIR}/.env" ]]; then
    warn "Archivo .env ya existe. No se sobreescribe."
    return
  fi

  if [[ -f "${INSTALL_DIR}/.env.example" ]]; then
    cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
  else
    cat > "${INSTALL_DIR}/.env" <<ENVEOF
PORT=${DEFAULT_PORT}
HOST=${DEFAULT_HOST}
DB_PATH=./data/systemdctl.db
NODE_ENV=production
ENVEOF
  fi

  # Asegurar NODE_ENV=production
  sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "${INSTALL_DIR}/.env"

  log "Archivo .env configurado"
  info "Editar ${INSTALL_DIR}/.env para ajustar HOST (IP de Tailscale) y PORT"
}

# --- Crear directorio de datos ---
setup_data_dir() {
  mkdir -p "${INSTALL_DIR}/data"
  log "Directorio de datos creado: ${INSTALL_DIR}/data"
}

# --- Crear servicio systemd ---
create_service() {
  local node_path
  node_path=$(command -v node)

  cat > "$SERVICE_FILE" <<SERVICEEOF
[Unit]
Description=systemdctl — Panel web para servicios systemd
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${node_path} server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF

  log "Servicio systemd creado: ${SERVICE_FILE}"
}

# --- Habilitar y arrancar ---
enable_and_start() {
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" --now
  log "Servicio ${SERVICE_NAME} habilitado y arrancado"
}

# --- Verificar que el servicio arranco ---
verify_service() {
  sleep 2

  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "Servicio ${SERVICE_NAME} corriendo correctamente"
  else
    err "El servicio no arranco. Revisar logs:"
    err "  journalctl -u ${SERVICE_NAME} -n 30 --no-pager"
    exit 1
  fi

  # Leer HOST y PORT del .env para el healthcheck
  local host port
  host=$(grep '^HOST=' "${INSTALL_DIR}/.env" | cut -d= -f2)
  port=$(grep '^PORT=' "${INSTALL_DIR}/.env" | cut -d= -f2)
  host=${host:-$DEFAULT_HOST}
  port=${port:-$DEFAULT_PORT}

  local health_url="http://${host}:${port}/api/health"
  info "Verificando healthcheck: ${health_url}"

  if curl -sf "${health_url}" > /dev/null 2>&1; then
    log "Healthcheck OK"
  else
    warn "Healthcheck no responde en ${health_url}"
    warn "Si HOST es una IP de Tailscale, verificar que Tailscale este activo"
    warn "Probar manualmente: curl ${health_url}"
  fi
}

# --- Resumen final ---
print_summary() {
  local host port
  host=$(grep '^HOST=' "${INSTALL_DIR}/.env" | cut -d= -f2)
  port=$(grep '^PORT=' "${INSTALL_DIR}/.env" | cut -d= -f2)
  host=${host:-$DEFAULT_HOST}
  port=${port:-$DEFAULT_PORT}

  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  systemdctl instalado correctamente${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}URL:${NC}          http://${host}:${port}"
  echo -e "  ${CYAN}Directorio:${NC}   ${INSTALL_DIR}"
  echo -e "  ${CYAN}Servicio:${NC}     ${SERVICE_NAME}"
  echo -e "  ${CYAN}Configuracion:${NC} ${INSTALL_DIR}/.env"
  echo -e "  ${CYAN}Base de datos:${NC} ${INSTALL_DIR}/data/systemdctl.db"
  echo ""
  echo -e "  ${YELLOW}Comandos utiles:${NC}"
  echo -e "    systemctl status ${SERVICE_NAME}"
  echo -e "    journalctl -u ${SERVICE_NAME} -f"
  echo -e "    systemctl restart ${SERVICE_NAME}"
  echo ""
  echo -e "  ${YELLOW}Para actualizar:${NC}"
  echo -e "    cd ${INSTALL_DIR} && git pull && npm install && npm run build && systemctl restart ${SERVICE_NAME}"
  echo ""
}

# === MAIN ===
main() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║  Instalador de systemdctl                ║${NC}"
  echo -e "${CYAN}║  Panel web para servicios systemd        ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
  echo ""

  check_root
  check_os
  check_systemd
  check_git
  check_node
  check_npm

  clone_or_update
  setup_data_dir
  setup_env
  build_project
  create_service
  enable_and_start
  verify_service
  print_summary
}

main "$@"
