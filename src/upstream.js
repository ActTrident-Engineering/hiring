'use strict';
// A stand-in for a model provider. Streams when asked, gzips when asked.
// Nothing here is part of the exercise - do not change it.
const http = require('node:http');
const zlib = require('node:zlib');

const PORT = Number(process.env.UPSTREAM_PORT || 7101);

http.createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* fine */ }

    if (body.stream === true) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      let i = 0;
      const iv = setInterval(() => {
        res.write(`event: delta\ndata: {"text":"chunk${i}"}\n\n`);
        if (++i >= 5) { clearInterval(iv); res.write('event: done\ndata: {}\n\n'); res.end(); }
      }, 120);
      return;
    }

    // Deliberately slow enough that concurrency is observable.
    setTimeout(() => {
      const payload = JSON.stringify({
        id: 'resp_1',
        model: body.model || 'demo-model',
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 180, output_tokens: 42 },
      });
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
        const gz = zlib.gzipSync(payload);
        res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip' });
        return res.end(gz);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(payload);
    }, 40);
  });
}).listen(PORT, '127.0.0.1', () => {
  process.stderr.write(`upstream on :${PORT}\n`);
});
