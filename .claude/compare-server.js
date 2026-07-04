const http = require('http');
const fs = require('fs');
const path = require('path');

// Sirve la carpeta ORIGINAL "Mundo Magico" en el puerto 8001
const root = path.resolve(process.cwd(), '..', 'Mundo Magico');
const port = 8001;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.woff': 'font/woff'
};

http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, path.normalize(urlPath));
    if (!filePath.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(filePath).toLowerCase();
      const type = types[ext] || 'application/octet-stream';
      const range = req.headers.range;
      if (range && /^bytes=/.test(range)) {
        const parts = range.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': type
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
        fs.createReadStream(filePath).pipe(res);
      }
    });
  } catch (e) { res.writeHead(500); res.end('Error'); }
}).listen(port, () => console.log('Serving ' + root + ' on http://localhost:' + port));
