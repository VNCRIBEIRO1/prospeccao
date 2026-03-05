// ============================================
// Rotas — Mensagens (histórico)
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET — Listar mensagens de um contato
router.get('/contato/:contatoId', async (req, res) => {
  try {
    const mensagens = await prisma.mensagem.findMany({
      where: { contatoId: parseInt(req.params.contatoId) },
      orderBy: { criadoEm: 'asc' }
    });
    res.json(mensagens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Registrar mensagem
router.post('/', async (req, res) => {
  try {
    const { contatoId, direcao, conteudo, etapa } = req.body;

    if (!contatoId || !direcao || !conteudo) {
      return res.status(400).json({ error: 'contatoId, direcao e conteudo são obrigatórios' });
    }

    const mensagem = await prisma.mensagem.create({
      data: {
        contatoId: parseInt(contatoId),
        direcao,
        conteudo,
        etapa
      }
    });

    res.status(201).json(mensagem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Templates de mensagens do bot
router.get('/templates', async (req, res) => {
  try {
    const MENSAGENS = require('../services/mensagens');
    const templates = Object.entries(MENSAGENS).map(([key, value]) => ({
      id: key,
      nome: key.replace(/_/g, ' ').replace(/msg/g, 'Mensagem ').trim(),
      conteudo: value,
      preview: value.substring(0, 120) + '...'
    }));
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT — Atualizar template de mensagem
router.put('/templates/:id', async (req, res) => {
  try {
    const { conteudo } = req.body;
    if (!conteudo) return res.status(400).json({ error: 'Conteúdo é obrigatório' });

    // Salvar no banco como configuração
    await prisma.configuracao.upsert({
      where: { chave: `msg_template_${req.params.id}` },
      update: { valor: conteudo },
      create: { chave: `msg_template_${req.params.id}`, valor: conteudo }
    });

    // Atualizar em memória
    const MENSAGENS = require('../services/mensagens');
    if (MENSAGENS[req.params.id] !== undefined) {
      MENSAGENS[req.params.id] = conteudo;
    }

    res.json({ sucesso: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Últimas mensagens (log)
router.get('/recentes', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const mensagens = await prisma.mensagem.findMany({
      take: parseInt(limit),
      orderBy: { criadoEm: 'desc' },
      include: { contato: { select: { nome: true, telefone: true } } }
    });
    res.json(mensagens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
