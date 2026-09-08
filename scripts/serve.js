'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 8765);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer((request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        const decoded = decodeURIComponent(url.pathname);
        const filename = path.resolve(root, `.${decoded}`);
        if (filename !== root && !filename.startsWith(root + path.sep)) throw new Error('Invalid path');
        let file = filename;
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
            if (!url.pathname.endsWith('/')) {
                response.writeHead(301, { Location: `${url.pathname}/${url.search}` }); response.end(); return;
            }
            file = path.join(file, 'index.html');
        }
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
            response.writeHead(404, { 'Content-Type': types['.html'] }); response.end(fs.readFileSync(path.join(root, '404.html'))); return;
        }
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
    } catch (_) { response.writeHead(400); response.end('Bad request'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
