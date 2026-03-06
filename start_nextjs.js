const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

// Start Next.js dev server
const frontendDir = path.join(__dirname, 'frontend');
console.log('Starting Next.js from:', frontendDir);

const { spawn } = require('child_process');
const child = spawn('node', ['node_modules/next/dist/bin/next', 'dev', '-p', '3000'], {
  cwd: frontendDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true
});

child.stdout.on('data', (data) => {
  process.stdout.write('[NEXT] ' + data.toString());
});

child.stderr.on('data', (data) => {
  process.stderr.write('[NEXT ERR] ' + data.toString());
});

child.on('close', (code) => {
  console.log('[NEXT] Process exited with code:', code);
});

// Write PID to file for later cleanup
require('fs').writeFileSync(path.join(__dirname, 'nextjs.pid'), child.pid.toString());
console.log('Next.js PID:', child.pid);

// Keep this script running
process.on('SIGINT', () => {
  child.kill();
  process.exit(0);
});
