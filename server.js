'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'site.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SEED_FILE = path.join(__dirname, 'seed', 'site.json');
const MAX_JSON = 1024 * 1024; // 1 MB
const MAX_UPLOAD = 50 * 1024 * 1024; // 50 MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

// ---------- data ----------
function ensureData() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) return;
  // First start on a new server: copy the starting content (and its images/files) in.
  fs.copyFileSync(SEED_FILE, DATA_FILE);
  const seedUploads = path.join(path.dirname(SEED_FILE), 'uploads');
  if (fs.existsSync(seedUploads)) {
    for (const f of fs.readdirSync(seedUploads)) {
      const dest = path.join(UPLOAD_DIR, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(seedUploads, f), dest);
    }
  }
}

async function readSite() {
  return JSON.parse(await fsp.readFile(DATA_FILE, 'utf8'));
}

async function writeSite(data) {
  const tmp = DATA_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, DATA_FILE);
}

function validSite(d) {
  return (
    d && typeof d === 'object' &&
    d.profile && typeof d.profile === 'object' &&
    Array.isArray(d.socials) && Array.isArray(d.sections)
  );
}

// ---------- helpers ----------
function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extra,
  });
  res.end(body);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), MIME['.json'], { 'Cache-Control': 'no-store' });
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const given = String(req.headers['x-admin-password'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function siteUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

async function serveFile(res, root, rel, cache) {
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep)) return send(res, 404, 'Not found');
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) return send(res, 404, 'Not found');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/site' && req.method === 'GET') {
    return json(res, 200, await readSite());
  }

  if (p === '/api/site' && req.method === 'PUT') {
    if (!isAdmin(req)) return json(res, 401, { error: 'Wrong password' });
    let data;
    try {
      data = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8'));
    } catch (e) {
      return json(res, e.status || 400, { error: e.status ? e.message : 'Invalid JSON' });
    }
    if (!validSite(data)) return json(res, 400, { error: 'Invalid site data' });
    await writeSite(data);
    return json(res, 200, { ok: true });
  }

  if (p === '/api/login' && req.method === 'POST') {
    if (!ADMIN_PASSWORD) return json(res, 503, { error: 'ADMIN_PASSWORD is not set on the server' });
    return isAdmin(req) ? json(res, 200, { ok: true }) : json(res, 401, { error: 'Wrong password' });
  }

  if (p === '/api/upload' && req.method === 'POST') {
    if (!isAdmin(req)) return json(res, 401, { error: 'Wrong password' });
    const original = String(url.searchParams.get('name') || 'file');
    const ext = path.extname(original).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
    const base = path.basename(original, path.extname(original))
      .toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
    const name = `${base}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    try {
      const buf = await readBody(req, MAX_UPLOAD);
      await fsp.writeFile(path.join(UPLOAD_DIR, name), buf);
    } catch (e) {
      return json(res, e.status || 500, { error: e.message });
    }
    return json(res, 200, { url: `/uploads/${name}` });
  }

  if (p === '/qr.png' || p === '/qr.svg') {
    const target = url.searchParams.get('url') || siteUrl(req);
    const opts = { margin: 2, width: Math.min(Number(url.searchParams.get('size')) || 1024, 4096), errorCorrectionLevel: 'M' };
    if (p === '/qr.svg') {
      return send(res, 200, await QRCode.toString(target, { ...opts, type: 'svg' }), MIME['.svg'], { 'Cache-Control': 'no-store' });
    }
    return send(res, 200, await QRCode.toBuffer(target, opts), MIME['.png'], { 'Cache-Control': 'no-store' });
  }

  if (p === '/api/qr-target') return json(res, 200, { url: siteUrl(req) });

  if (p === '/health') return send(res, 200, 'ok');

  if (p.startsWith('/uploads/')) {
    return serveFile(res, UPLOAD_DIR, p.slice('/uploads/'.length), 'public, max-age=86400');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (p === '/' ) return serveFile(res, PUBLIC_DIR, 'index.html', 'no-cache');
  if (p === '/admin' || p === '/admin/') return serveFile(res, PUBLIC_DIR, 'admin.html', 'no-cache');
  return serveFile(res, PUBLIC_DIR, p.replace(/^\/+/, ''), 'public, max-age=3600');
}

ensureData();
http
  .createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, 'Server error');
      else res.end();
    });
  })
  .listen(PORT, () => {
    console.log(`zenaa-socials running on port ${PORT}`);
    if (!ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD not set - /admin editing is disabled.');
  });
