// ============================================
// server.js — Servidor Express principal
// ============================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./services/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// Middlewares
// ============================================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://prospeccao.vercel.app',
    'https://prospeccao-*.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' }
});
app.use('/api/', limiter);

// Log de requisições
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    body: req.method === 'POST' ? '...' : undefined 
  });
  next();
});

// ============================================
// Rotas
// ============================================
const contatosRouter = require('./routes/contatos');
const campanhasRouter = require('./routes/campanhas');
const leadsRouter = require('./routes/leads');
const webhookRouter = require('./routes/webhook');
const mensagensRouter = require('./routes/mensagens');
const configRouter = require('./routes/configuracoes');
const metricsRouter = require('./routes/metricas');

const n8nRouter = require('./routes/n8n');

app.use('/api/contatos', contatosRouter);
app.use('/api/campanhas', campanhasRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/mensagens', mensagensRouter);
app.use('/api/configuracoes', configRouter);
app.use('/api/metricas', metricsRouter);
app.use('/api/n8n', n8nRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Error handler global
// ============================================
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ============================================
// Inicializar servidor e fila
// ============================================
const { inicializarFila } = require('./services/disparos');
const { autoConfigurarWebhook, verificarConexao } = require('./services/evolution');
const { inicializarScheduler } = require('./services/scheduler');

app.listen(PORT, async () => {
  logger.info(`🚀 Backend rodando na porta ${PORT}`);
  
  // Inicializar fila Redis
  try {
    await inicializarFila();
    logger.info('📨 Fila de disparos inicializada');
  } catch (err) {
    logger.warn('⚠️ Redis não disponível - fila de disparos desabilitada', { error: err.message });
  }

  // Inicializar scheduler de tarefas automáticas
  try {
    inicializarScheduler();
  } catch (err) {
    logger.warn('⚠️ Scheduler não inicializado', { error: err.message });
  }

  // Auto-configurar webhook no WPPConnect (aguarda 5s para o container estar pronto)
  setTimeout(async () => {
    try {
      const status = await verificarConexao();
      if (status.sucesso) {
        const resultado = await autoConfigurarWebhook();
        if (resultado.sucesso) {
          logger.info('🔗 Webhook auto-configurado no startup');
        }
      } else {
        logger.warn('⚠️ WPPConnect não acessível — webhook será configurado quando conectar');
      }
    } catch (err) {
      logger.warn('⚠️ Falha ao auto-configurar webhook', { error: err.message });
    }
  }, 5000);
});

module.exports = app;
