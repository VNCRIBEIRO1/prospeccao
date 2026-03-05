// ============================================
// Rotas — Leads (CRUD + Pipeline Kanban)
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const logger = require('../services/logger');

// GET — Listar leads (agrupados por estágio para Kanban)
router.get('/', async (req, res) => {
  try {
    const { estagio, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (estagio) where.estagio = estagio;

    const leads = await prisma.lead.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { criadoEm: 'desc' },
      include: {
        contato: {
          include: {
            _count: { select: { mensagens: true } }
          }
        }
      }
    });

    // Agrupar por estágio
    const kanban = {
      novo: leads.filter(l => l.estagio === 'novo'),
      interessado: leads.filter(l => l.estagio === 'interessado'),
      negociando: leads.filter(l => l.estagio === 'negociando'),
      fechado: leads.filter(l => l.estagio === 'fechado')
    };

    res.json({ leads, kanban, total: leads.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Lead por ID
router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        contato: {
          include: {
            mensagens: { orderBy: { criadoEm: 'desc' } }
          }
        }
      }
    });

    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Criar lead manualmente
router.post('/', async (req, res) => {
  try {
    const { contatoId, estagio = 'novo', notas } = req.body;

    if (!contatoId) return res.status(400).json({ error: 'contatoId é obrigatório' });

    // Verificar se já existe lead para este contato
    const existente = await prisma.lead.findFirst({
      where: { contatoId: parseInt(contatoId) }
    });

    if (existente) {
      return res.status(409).json({ error: 'Já existe um lead para este contato', lead: existente });
    }

    const lead = await prisma.lead.create({
      data: {
        contatoId: parseInt(contatoId),
        estagio,
        notas
      },
      include: { contato: true }
    });

    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH — Atualizar estágio do lead (mover no Kanban)
router.patch('/:id', async (req, res) => {
  try {
    const { estagio, notas } = req.body;
    const data = {};

    if (estagio) data.estagio = estagio;
    if (notas !== undefined) data.notas = notas;

    const lead = await prisma.lead.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: { contato: true }
    });

    // Se fechou, atualizar status do contato
    if (estagio === 'fechado') {
      await prisma.contato.update({
        where: { id: lead.contatoId },
        data: { status: 'fechado' }
      });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE — Excluir lead
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ mensagem: 'Lead excluído' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
