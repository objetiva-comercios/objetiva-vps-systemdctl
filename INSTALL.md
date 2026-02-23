# Instalacion como servicio systemd

## Prerequisitos

- Node.js >= 20
- npm
- Acceso sudo / root
- Tailscale configurado (IP: `100.87.113.34`)

## Instalacion

### 1. Instalar dependencias y compilar frontend

```bash
cd /home/sanchez/proyectos/objetiva-vps-systemdctl
npm install
npm run build
```

### 2. Configurar variables de entorno

Editar `.env` en la raiz del proyecto:

```env
PORT=7700
HOST=100.87.113.34
DB_PATH=./data/systemdctl.db
NODE_ENV=production
```

### 3. Crear el servicio systemd

Crear el archivo `/etc/systemd/system/objetiva-vps-systemdctl.service`:

```ini
[Unit]
Description=Objetiva VPS - systemdctl dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/sanchez/proyectos/objetiva-vps-systemdctl
ExecStart=/usr/bin/node server/index.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 4. Habilitar e iniciar el servicio

```bash
sudo systemctl daemon-reload
sudo systemctl enable objetiva-vps-systemdctl
sudo systemctl start objetiva-vps-systemdctl
```

### 5. Verificar

```bash
systemctl status objetiva-vps-systemdctl
curl http://100.87.113.34:7700
```

## Comandos utiles

```bash
# Ver estado del servicio
systemctl status objetiva-vps-systemdctl

# Ver logs en tiempo real
journalctl -u objetiva-vps-systemdctl -f

# Reiniciar servicio
sudo systemctl restart objetiva-vps-systemdctl

# Detener servicio
sudo systemctl stop objetiva-vps-systemdctl

# Deshabilitar (no arranca con el sistema)
sudo systemctl disable objetiva-vps-systemdctl
```

## Desinstalacion

```bash
sudo systemctl stop objetiva-vps-systemdctl
sudo systemctl disable objetiva-vps-systemdctl
sudo rm /etc/systemd/system/objetiva-vps-systemdctl.service
sudo systemctl daemon-reload
```
