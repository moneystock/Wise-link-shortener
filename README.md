# 🚀 WiseLinks - Plataforma Local de Acortamiento de URLs & Analíticas (Versión 0)

Prototipo funcional local y 100% gratuito (costo \$0) de acortador de URLs con analíticas de clics y generación dinámica de códigos QR, diseñado específicamente para agencias de marketing digital. Soporta múltiples espacios de trabajo, iniciando con **Wise Marketing Agency** y permitiendo simular clientes como **Onclusive**.

---

## 🛠️ Stack Tecnológico
- **Backend:** Node.js con Express 5.
- **Base de Datos:** SQLite local embebida mediante `better-sqlite3` (archivo autogenerado `database.sqlite`).
- **Frontend:** HTML5 semántico, CSS3 moderno con variables (soporte de Modo Claro y Modo Oscuro) y Vanilla JavaScript (ES Modules).
- **Librerías (CDN):** 
  - `qrcode.js`: Generación de códigos QR en alta resolución en el navegador.
  - `Chart.js`: Visualización gráfica de clics y distribución por espacio de trabajo.

---

## 📁 Estructura del Proyecto

```text
kind-volta/
├── database.sqlite       # Base de datos SQLite (se autogenera al iniciar)
├── db.js                 # Configuración de SQLite, esquema y tablas
├── server.js             # Servidor Express, API REST y redirección 302
├── package.json          # Dependencias y scripts de ejecución
├── README.md             # Documentación del proyecto
└── public/               # Frontend servido directamente por Express
    ├── index.html        # Dashboard principal de marketing
    ├── styles.css        # Estilos modernos y modo claro/oscuro
    └── app.js            # Lógica cliente, multi-workspace y QR
```

---

## ⚙️ Esquema de Base de Datos (SQLite)

- **`links`**:
  - `id`: Clave primaria autoincremental.
  - `original_url`: URL larga de destino.
  - `short_code`: Slug o alias único (ej. `campana-q4` o código aleatorio de 6 caracteres).
  - `workspace`: `'wise'` o `'onclusive'`.
  - `created_at`: Fecha y hora de creación.
  - `clicks_count`: Contador de clics.
  - `expires_at`: Fecha y hora de expiración (opcional).

- **`clicks_log`**:
  - `id`: Clave primaria autoincremental.
  - `link_id`: Clave foránea asociada a `links(id)`.
  - `clicked_at`: Timestamp del clic.
  - `ip_address`: Dirección IP del visitante.
  - `user_agent`: Navegador y dispositivo del visitante.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Prerrequisitos
Tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior).

### 2. Instalar dependencias
Desde la terminal en la raíz del proyecto, ejecuta:
```bash
npm install
```

### 3. Iniciar el servidor
```bash
node server.js
```
*O con soporte de reinicio automático:*
```bash
npm run dev
```

### 4. Acceder al Panel de Control
Abre tu navegador web en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔌 Endpoints de la API REST

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/links` | Crea un nuevo enlace acortado (`original_url`, `short_code`, `workspace`, `expires_at`). |
| `GET` | `/api/links` | Lista los enlaces creados (soporta filtro opcional `?workspace=wise` o `?workspace=onclusive`). |
| `GET` | `/api/links/:id` | Detalle del enlace con los últimos 50 registros de auditoría de clics (IP, User-Agent). |
| `DELETE` | `/api/links/:id` | Elimina un enlace y su historial de clics. |
| `GET` | `/api/stats/overview`| Resumen global de métricas y tendencias de clics para gráficas. |
| `GET` | `/:short_code` | **Ruta pública de redirección.** Registra el clic en la base de datos (IP, User-Agent, incrementa contador) y redirige vía HTTP 302 a la URL original. |

---

## 💡 Características Clave de la Interfaz

1. **Selector Visual de Workspace:** Alterna entre "Wise Agency" y "Onclusive" para segmentar campañas y métricas.
2. **Generación Instantánea de Código QR:** Renderiza el QR del enlace generado con opción de **descarga directa en PNG**.
3. **Copia Rápida:** Botón de un solo clic con animación de confirmación (ícono de check).
4. **Auditoría de Clics:** Modal interactivo para inspeccionar quién, cuándo y desde qué navegador se hizo clic.
5. **Modo Claro / Oscuro:** Selector en la cabecera que guarda tu preferencia en `localStorage`.

---

## ☁️ Despliegue en Producción 24/7 (Fly.io / Docker / Render)

### 1. Variables de Entorno en Producción
Copia `.env.example` a `.env` o define estas variables en tu proveedor de hosting:

```env
PORT=3000
NODE_ENV=production
BASE_URL=https://go.wisemarketing.agency
DB_DIR=/data
```

### 2. Despliegue en Fly.io (Recomendado - Gratuito con volumen NVMe)

Fly.io permite correr SQLite con discos persistentes y certificado SSL automático para tu subdominio:

1. Instala el CLI de Fly (`flyctl`) e inicia sesión:
   ```bash
   fly auth login
   ```
2. Inicializa la app con el archivo `fly.toml` incluido:
   ```bash
   fly launch --no-deploy
   ```
3. Crea el volumen persistente para la base de datos SQLite:
   ```bash
   fly volumes create wise_data --size 1 --region qro
   ```
4. Despliega la aplicación:
   ```bash
   fly deploy
   ```
5. Vincula tu subdominio personalizado:
   ```bash
   fly certs create go.wisemarketing.agency
   ```

### 3. Configuración del DNS en tu Registrador (GoDaddy, Namecheap, Cloudflare, etc.)

Crea el siguiente registro DNS en la zona de `wisemarketing.agency`:

| Tipo | Nombre (Host) | Valor (Destino) | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `go` | `wise-link-shortener.fly.dev` (o tu dominio de Render) | Automático |

Fly.io o Cloudflare emitirá y renovará automáticamente el certificado **HTTPS / SSL** de forma gratuita. Todos los enlaces acortados y códigos QR saldrán con `https://go.wisemarketing.agency/tu-alias`.

