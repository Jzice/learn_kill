// dist 静态服务器：node scripts/serve-dist.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.argv[2] || 8901);
const root = path.resolve(import.meta.dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

http
  .createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`serving ${root} at http://127.0.0.1:${port}/`);
  });
