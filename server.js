const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Palabras reservadas para evitar colisiones con rutas del sistema y archivos estáticos
const RESERVED_SLUGS = new Set([
  'api', 'public', 'favicon.ico', 'robots.txt', 'index.html',
  'styles.css', 'app.js', 'assets', 'health', 'docs'
]);

// Confianza en proxies inversos (Cloudflare, Nginx, Render, etc.)
app.set('trust proxy', true);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health check para balanceadores de carga y monitoreo en la nube
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Función auxiliar para obtener la URL base
function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}`;
}

// Función para generar la URL pública de marca según el workspace / cliente
function getLinkUrl(req, workspace, shortCode) {
  const host = (req.get('host') || `localhost:${PORT}`).toLowerCase();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;

  // En entorno local de pruebas, mantener localhost
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `${protocol}://${host}/${shortCode}`;
  }

  // En producción, si el enlace pertenece a Onclusive, usar su subdominio dedicado
  if (workspace && workspace.toLowerCase() === 'onclusive') {
    return `https://onclusive.wisemarketing.agency/${shortCode}`;
  }

  // Para Wise Agency o por defecto
  return `https://go.wisemarketing.agency/${shortCode}`;
}

// Generador de código corto único (alfanumérico, amigable)
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Normalizar y validar URL
function normalizeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('La URL es requerida.');
  }

  let cleaned = inputUrl.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Solo se permiten protocolos HTTP y HTTPS.');
    }
    return parsed.href;
  } catch (err) {
    throw new Error('El formato de la URL no es válido. Ejemplo: https://google.com');
  }
}

// ==========================================
// RUTAS DE LA API (REST)
// ==========================================

// 1. POST /api/links - Crear nuevo enlace acortado
app.post('/api/links', (req, res) => {
  try {
    const { original_url, short_code, workspace, expires_at } = req.body;

    // Validación de URL
    const validatedUrl = normalizeUrl(original_url);

    // Validación de Workspace
    const normalizedWorkspace = (workspace && workspace.toLowerCase() === 'onclusive') 
      ? 'onclusive' 
      : 'wise';

    let finalShortCode = short_code ? short_code.trim() : null;

    if (finalShortCode) {
      // Validar formato del alias personalizado (3-40 caracteres, letras, números, guiones y guiones bajos)
      const aliasRegex = /^[a-zA-Z0-9_-]{3,40}$/;
      if (!aliasRegex.test(finalShortCode)) {
        return res.status(400).json({
          success: false,
          error: 'El alias personalizado debe tener entre 3 y 40 caracteres y contener solo letras, números, guiones (-) o guiones bajos (_).'
        });
      }

      if (RESERVED_SLUGS.has(finalShortCode.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `El alias "${finalShortCode}" está reservado por el sistema.`
        });
      }

      // Verificar si ya existe
      const existing = db.prepare('SELECT id FROM links WHERE short_code = ?').get(finalShortCode);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `El alias "${finalShortCode}" ya está en uso. Por favor elija uno diferente.`
        });
      }
    } else {
      // Generar código aleatorio no colisionante
      let attempts = 0;
      do {
        finalShortCode = generateShortCode(6);
        const existing = db.prepare('SELECT id FROM links WHERE short_code = ?').get(finalShortCode);
        if (!existing && !RESERVED_SLUGS.has(finalShortCode.toLowerCase())) {
          break;
        }
        attempts++;
      } while (attempts < 10);
    }

    // Validación opcional de expiración
    let finalExpiresAt = null;
    if (expires_at) {
      const expDate = new Date(expires_at);
      if (!isNaN(expDate.getTime())) {
        finalExpiresAt = expDate.toISOString();
      }
    }

    // Insertar en la base de datos
    const stmt = db.prepare(`
      INSERT INTO links (original_url, short_code, workspace, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(validatedUrl, finalShortCode, normalizedWorkspace, finalExpiresAt);
    const newLink = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Enlace acortado con éxito.',
      data: {
        ...newLink,
        short_url: getLinkUrl(req, newLink.workspace, newLink.short_code)
      }
    });

  } catch (error) {
    console.error('Error al crear enlace:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Error interno del servidor.'
    });
  }
});

// 2. GET /api/links - Listar todos los enlaces con métricas
app.get('/api/links', (req, res) => {
  try {
    const { workspace } = req.query;
    let stmt;

    if (workspace && (workspace === 'wise' || workspace === 'onclusive')) {
      stmt = db.prepare('SELECT * FROM links WHERE workspace = ? ORDER BY created_at DESC');
      const rows = stmt.all(workspace);
      const data = rows.map(r => ({ ...r, short_url: getLinkUrl(req, r.workspace, r.short_code) }));
      return res.json({ success: true, count: data.length, data });
    }

    stmt = db.prepare('SELECT * FROM links ORDER BY created_at DESC');
    const rows = stmt.all();
    const data = rows.map(r => ({ ...r, short_url: getLinkUrl(req, r.workspace, r.short_code) }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Error al obtener enlaces:', error);
    return res.status(500).json({ success: false, error: 'Error al consultar los enlaces.' });
  }
});

// 3. GET /api/links/:id - Detalle de un enlace con su registro de clics
app.get('/api/links/:id', (req, res) => {
  try {
    const { id } = req.params;
    const link = db.prepare('SELECT * FROM links WHERE id = ?').get(id);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Enlace no encontrado.' });
    }

    const clicks = db.prepare(`
      SELECT id, clicked_at, ip_address, user_agent 
      FROM clicks_log 
      WHERE link_id = ? 
      ORDER BY clicked_at DESC 
      LIMIT 50
    `).all(id);

    return res.json({
      success: true,
      data: {
        ...link,
        short_url: getLinkUrl(req, link.workspace, link.short_code),
        recent_clicks: clicks
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle del enlace:', error);
    return res.status(500).json({ success: false, error: 'Error al consultar el detalle.' });
  }
});

// 4. DELETE /api/links/:id - Eliminar enlace
app.delete('/api/links/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id, short_code FROM links WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Enlace no encontrado.' });
    }

    db.prepare('DELETE FROM links WHERE id = ?').run(id);

    return res.json({
      success: true,
      message: `El enlace /${existing.short_code} ha sido eliminado satisfactoriamente.`
    });
  } catch (error) {
    console.error('Error al eliminar enlace:', error);
    return res.status(500).json({ success: false, error: 'Error al eliminar el enlace.' });
  }
});

// 5. GET /api/stats/overview - Métricas globales para analítica y Chart.js
app.get('/api/stats/overview', (req, res) => {
  try {
    const totalLinks = db.prepare('SELECT COUNT(*) as count FROM links').get().count;
    const totalClicks = db.prepare('SELECT COALESCE(SUM(clicks_count), 0) as count FROM links').get().count;

    const wiseLinks = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(clicks_count), 0) as clicks FROM links WHERE workspace = 'wise'").get();
    const onclusiveLinks = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(clicks_count), 0) as clicks FROM links WHERE workspace = 'onclusive'").get();

    // Clics agrupados por fecha (últimos 7 días)
    const timeline = db.prepare(`
      SELECT DATE(clicked_at) as date, COUNT(*) as count
      FROM clicks_log
      WHERE clicked_at >= datetime('now', '-7 days')
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `).all();

    // Top 5 enlaces más clickeados
    const topLinks = db.prepare(`
      SELECT id, short_code, original_url, workspace, clicks_count
      FROM links
      ORDER BY clicks_count DESC
      LIMIT 5
    `).all();

    return res.json({
      success: true,
      stats: {
        totalLinks,
        totalClicks,
        workspaces: {
          wise: { links: wiseLinks.count, clicks: wiseLinks.clicks },
          onclusive: { links: onclusiveLinks.count, clicks: onclusiveLinks.clicks }
        },
        timeline,
        topLinks
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas globales:', error);
    return res.status(500).json({ success: false, error: 'Error al calcular estadísticas.' });
  }
});

// ==========================================
// RUTA PÚBLICA DE REDIRECCIÓN (GET /:short_code)
// ==========================================
app.get('/:short_code', (req, res) => {
  const { short_code } = req.params;

  // Ignorar peticiones de recursos que no coincidan con un código
  if (RESERVED_SLUGS.has(short_code.toLowerCase())) {
    return res.status(404).send('Recurso no encontrado.');
  }

  try {
    const host = (req.get('host') || '').toLowerCase();
    let link = null;

    if (host.startsWith('onclusive.')) {
      link = db.prepare('SELECT * FROM links WHERE short_code = ? AND workspace = "onclusive"').get(short_code);
    }

    if (!link) {
      link = db.prepare('SELECT * FROM links WHERE short_code = ?').get(short_code);
    }

    if (!link) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enlace no encontrado | Wise Marketing</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h1 { color: #f43f5e; margin-bottom: 0.5rem; }
            p { color: #94a3b8; line-height: 1.6; }
            a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #6366f1; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; }
            a:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>404 - Enlace No Encontrado</h1>
            <p>El código <strong>/${escapeHtml(short_code)}</strong> no existe en el sistema o fue eliminado.</p>
            <a href="/">Ir al Panel Principal</a>
          </div>
        </body>
        </html>
      `);
    }

    // Verificar si el enlace ha expirado
    if (link.expires_at) {
      const expirationDate = new Date(link.expires_at);
      if (new Date() > expirationDate) {
        return res.status(410).send(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Enlace Expirado | Wise Marketing</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; max-width: 480px; }
              h1 { color: #eab308; margin-bottom: 0.5rem; }
              p { color: #94a3b8; }
              a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #6366f1; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Enlace Expirado</h1>
              <p>Este enlace de campaña ha caducado el <strong>${expirationDate.toLocaleString()}</strong>.</p>
              <a href="/">Ir al Panel Principal</a>
            </div>
          </body>
          </html>
        `);
      }
    }

    // Registrar analítica de clic (Captura de IP real tras Cloudflare o proxies)
    const ip = req.headers['cf-connecting-ip'] || 
               req.headers['x-real-ip'] || 
               (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
               req.socket.remoteAddress || 
               '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Desconocido';

    // Transacción atómica en SQLite: guardar clic e incrementar contador
    const trackClick = db.transaction(() => {
      db.prepare(`
        INSERT INTO clicks_log (link_id, ip_address, user_agent) 
        VALUES (?, ?, ?)
      `).run(link.id, String(ip).slice(0, 45), String(userAgent).slice(0, 255));

      db.prepare(`
        UPDATE links 
        SET clicks_count = clicks_count + 1 
        WHERE id = ?
      `).run(link.id);
    });

    trackClick();

    // Redirección HTTP 302 hacia la URL original
    return res.redirect(302, link.original_url);

  } catch (error) {
    console.error('Error durante la redirección:', error);
    return res.status(500).send('Error interno al procesar el enlace.');
  }
});

// Escape HTML básico para seguridad en mensajes de error
function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Wise Link Shortener iniciado en:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`📊 Panel de control y API listos`);
  console.log(`=======================================================`);
});
