import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function serveCompressed(req, res, statusCode, contentType, contentBuffer, isImmutable = false) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  };

  if (isImmutable) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }

  if (/\bbr\b/.test(acceptEncoding) && zlib.brotliCompress) {
    zlib.brotliCompress(contentBuffer, (err, compressed) => {
      if (!err) {
        headers['Content-Encoding'] = 'br';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(statusCode, headers);
        res.end(compressed);
      } else {
        serveGzipOrRaw(req, res, statusCode, headers, contentBuffer);
      }
    });
  } else {
    serveGzipOrRaw(req, res, statusCode, headers, contentBuffer);
  }
}

function serveGzipOrRaw(req, res, statusCode, headers, contentBuffer) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (/\bgzip\b/.test(acceptEncoding)) {
    zlib.gzip(contentBuffer, (err, compressed) => {
      if (!err) {
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(statusCode, headers);
        res.end(compressed);
      } else {
        res.writeHead(statusCode, headers);
        res.end(contentBuffer);
      }
    });
  } else {
    res.writeHead(statusCode, headers);
    res.end(contentBuffer);
  }
}

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];
  try {
    cleanUrl = decodeURIComponent(cleanUrl);
  } catch (e) {}

  if (cleanUrl === '/') {
    cleanUrl = '/index.html';
  }

  let filePath = path.join(__dirname, cleanUrl);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          serveCompressed(req, res, 200, 'text/html; charset=utf-8', data, false);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutable = !ext.includes('html');

    fs.readFile(filePath, (readErr, contentBuffer) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error');
        return;
      }
      serveCompressed(req, res, 200, contentType, contentBuffer, isImmutable);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Tourixa Travel high-performance server running at http://localhost:${PORT}`);
});
