const next = require('next');
const http = require('http');

const app = next({ dev: true, dir: __dirname });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3001;

app.prepare().then(() => {
  http.createServer((req, res) => handle(req, res)).listen(PORT, '0.0.0.0', () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
