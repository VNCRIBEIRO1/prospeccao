// Ponto de entrada raiz do projeto — inicia o frontend Next.js
// Uso: node server.js  (a partir de qualquer subdiretório de 'projeto')
const path = require('path');
const frontendDir = path.join(__dirname, 'frontend');

process.chdir(frontendDir);
require(path.join(frontendDir, 'server.js'));
