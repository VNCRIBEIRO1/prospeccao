// ============================================
// Rotas — Campanhas (CRUD + disparo)
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { dispararCampanha, pausarCampanha, statusFila } = require('../services/disparos');
const logger = require('../services/logger');

// GET — Listar campanhas
router.get('/', async (req, res) => {
  try {
    const campanhas = await prisma.campanha.findMany({
      orderBy: { criadoEm: 'desc' }
    });
    res.json(campanhas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Status da fila de disparos (DEVE vir antes de /:id)
router.get('/fila/status', async (req, res) => {
  try {
    const status = await statusFila();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Buscar campanha por ID
router.get('/:id', async (req, res) => {
  try {
    const campanha = await prisma.campanha.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(campanha);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Criar campanha
router.post('/', async (req, res) => {
  try {
    const { nome, delaySegundos = 60, limiteDiario = 50 } = req.body;

    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // Validações de segurança
    const minDelay = parseInt(process.env.DELAY_MIN_SEGUNDOS || '45');
    const maxDia = parseInt(process.env.MAX_DISPAROS_DIA || '50');

    const campanha = await prisma.campanha.create({
      data: {
        nome,
        delaySegundos: Math.max(delaySegundos, minDelay),
        limiteDiario: Math.min(limiteDiario, maxDia)
      }
    });

    res.status(201).json(campanha);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Iniciar campanha
router.post('/:id/iniciar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.campanha.update({
      where: { id },
      data: { status: 'ativa' }
    });

    const resultado = await dispararCampanha(id);

    logger.info('Campanha iniciada', { campanhaId: id, contatos: resultado.total });
    res.json({
      mensagem: 'Campanha iniciada',
      contatosEnfileirados: resultado.total
    });
  } catch (error) {
    logger.error('Erro ao iniciar campanha', { erro: error.message });
    res.status(500).json({ error: error.message });
  }
});

// POST — Pausar campanha
router.post('/:id/pausar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pausarCampanha(id);

    logger.info('Campanha pausada', { campanhaId: id });
    res.json({ mensagem: 'Campanha pausada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH — Atualizar campanha
router.patch('/:id', async (req, res) => {
  try {
    const { nome, delaySegundos, limiteDiario } = req.body;
    const data = {};

    if (nome) data.nome = nome;
    if (delaySegundos !== undefined) data.delaySegundos = Math.max(delaySegundos, 45);
    if (limiteDiario !== undefined) data.limiteDiario = Math.min(limiteDiario, 80);

    const campanha = await prisma.campanha.update({
      where: { id: parseInt(req.params.id) },
      data
    });

    res.json(campanha);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE — Excluir campanha
router.delete('/:id', async (req, res) => {
  try {
    await pausarCampanha(parseInt(req.params.id));
    await prisma.campanha.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ mensagem: 'Campanha excluída' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
