# ==========================================
# Dockerfile para WiseLinks en Producción
# ==========================================
FROM node:22-slim

# Directorio de la aplicación
WORKDIR /app

# Instalar dependencias primero para aprovechar la caché de capas de Docker
COPY package*.json ./

RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Crear directorio para la base de datos persistente SQLite
RUN mkdir -p /data && chown -R node:node /data /app

# Cambiar a usuario no-root por seguridad
USER node

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000 \
    DB_DIR=/data

# Exponer el puerto del servidor
EXPOSE 3000

# Health check del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Comando de arranque
CMD ["node", "server.js"]
