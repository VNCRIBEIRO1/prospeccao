// ============================================
// Rotas — Configurações + Evolution API
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { obterQRCode, verificarConexao, configurarWebhook, autoConfigurarWebhook, obterInfoInstancia, desconectar, reiniciarInstancia, iniciarConexao, obterQRCodeCache } = require('../services/evolution');
const logger = require('../services/logger');

// GET — Listar configurações
router.get('/', async (req, res) => {
  try {
    const configs = await prisma.configuracao.findMany();
    const configMap = {};
    configs.forEach(c => { configMap[c.chave] = c.valor; });

    // Adicionar valores do .env
    configMap.EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
    configMap.EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ? '***configurado***' : '';
    configMap.EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'prospeccao';
    configMap.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ? '***configurado***' : '';
    configMap.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

    res.json(configMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Salvar configuração
router.post('/', async (req, res) => {
  try {
    const { chave, valor } = req.body;
    if (!chave) return res.status(400).json({ error: 'Chave é obrigatória' });

    const config = await prisma.configuracao.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor }
    });

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Status da conexão WhatsApp
router.get('/whatsapp/status', async (req, res) => {
  try {
    const status = await verificarConexao();
    res.json(status);
  } catch (error) {
    res.json({ sucesso: false, conectado: false, estado: 'error' });
  }
});

// POST — Conectar WhatsApp (inicia conexão, QR Code vem via webhook)
router.post('/whatsapp/conectar', async (req, res) => {
  try {
    const resultado = await iniciarConexao();

    // Se já está conectado, auto-configurar webhook
    if (resultado.conectado) {
      await autoConfigurarWebhook();
    }

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Obter QR Code armazenado (frontend faz polling aqui)
// O QR Code é recebido via webhook QRCODE_UPDATED e armazenado em memória
router.get('/whatsapp/qrcode', async (req, res) => {
  try {
    // Verificar se já conectou
    const status = await verificarConexao();
    if (status.conectado) {
      return res.json({ sucesso: true, conectado: true });
    }

    // Buscar QR do cache (recebido via webhook)
    const qrCache = obterQRCodeCache();
    if (qrCache && qrCache.base64 && !qrCache.expirado) {
      return res.json({
        sucesso: true,
        conectado: false,
        qrCode: qrCache.base64,
        pairingCode: qrCache.pairingCode,
        count: qrCache.count,
        expirado: false
      });
    }

    // QR ainda não chegou ou expirou
    res.json({
      sucesso: true,
      conectado: false,
      qrCode: null,
      pairingCode: qrCache?.pairingCode || null,
      expirado: qrCache?.expirado || false,
      aguardando: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Desconectar WhatsApp (logout)
router.post('/whatsapp/desconectar', async (req, res) => {
  try {
    const resultado = await desconectar();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Reiniciar instância WhatsApp
router.post('/whatsapp/reiniciar', async (req, res) => {
  try {
    const resultado = await reiniciarInstancia();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Configurar Webhook na Evolution API
router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const webhookUrl = req.body.url || null; // null = usa o padrão com host.docker.internal
    const resultado = await configurarWebhook(webhookUrl);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Info da instância
router.get('/whatsapp/info', async (req, res) => {
  try {
    const info = await obterInfoInstancia();
    res.json(info);
  } catch (error) {
    res.json({ sucesso: false, data: null });
  }
});

module.exports = router;
