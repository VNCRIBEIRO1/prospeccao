// ============================================
// Rotas — n8n Integration (Webhooks & Triggers)
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { enviarMensagemBot } = require('../services/disparos');
const { verificarConexao } = require('../services/evolution');
const { enviarRelatorioDiario, processarFollowUps, resetDiario } = require('../services/scheduler');
const logger = require('../services/logger');

// ============================================
// Webhooks para n8n chamar (ações)
// ============================================

// POST — Enviar mensagem personalizada para contato
router.post('/enviar-mensagem', async (req, res) => {
  try {
    const { contatoId, etapa, mensagemCustom } = req.body;
    if (!contatoId) return res.status(400).json({ error: 'contatoId obrigatório' });

    if (mensagemCustom) {
      // Mensagem customizada (não do bot)
      const { enviarMensagem } = require('../services/evolution');
      const contato = await prisma.contato.findUnique({ where: { id: parseInt(contatoId) } });
      if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });

      const resultado = await enviarMensagem(contato.telefone, mensagemCustom);
      if (resultado.sucesso) {
        await prisma.mensagem.create({
          data: { contatoId: parseInt(contatoId), direcao: 'enviada', conteudo: mensagemCustom.substring(0, 500), etapa: 'custom' }
        });
      }
      return res.json(resultado);
    }

    const resultado = await enviarMensagemBot(parseInt(contatoId), etapa || 'msg1');
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Disparar follow-ups manualmente
router.post('/followups', async (req, res) => {
  try {
    await processarFollowUps();
    res.json({ sucesso: true, mensagem: 'Follow-ups processados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Disparar reset diário manualmente
router.post('/reset-diario', async (req, res) => {
  try {
    await resetDiario();
    res.json({ sucesso: true, mensagem: 'Reset diário executado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Enviar relatório diário manualmente
router.post('/relatorio', async (req, res) => {
  try {
    await enviarRelatorioDiario();
    res.json({ sucesso: true, mensagem: 'Relatório enviado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Atualizar status de contato (para n8n workflows)
router.post('/atualizar-contato', async (req, res) => {
  try {
    const { contatoId, status, etapaBot, notas } = req.body;
    if (!contatoId) return res.status(400).json({ error: 'contatoId obrigatório' });

    const data = {};
    if (status) data.status = status;
    if (etapaBot) data.etapaBot = etapaBot;

    const contato = await prisma.contato.update({
      where: { id: parseInt(contatoId) },
      data
    });

    // Se tem notas, atualizar/criar lead
    if (notas) {
      await prisma.lead.upsert({
        where: { id: (await prisma.lead.findFirst({ where: { contatoId: parseInt(contatoId) } }))?.id || 0 },
        update: { notas },
        create: { contatoId: parseInt(contatoId), notas, estagio: status === 'interessado' ? 'interessado' : 'novo' }
      });
    }

    res.json({ sucesso: true, contato });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Criar lead a partir do n8n
router.post('/criar-lead', async (req, res) => {
  try {
    const { contatoId, estagio = 'novo', notas } = req.body;
    if (!contatoId) return res.status(400).json({ error: 'contatoId obrigatório' });

    const existente = await prisma.lead.findFirst({ where: { contatoId: parseInt(contatoId) } });
    if (existente) {
      const lead = await prisma.lead.update({ where: { id: existente.id }, data: { estagio, notas } });
      return res.json({ sucesso: true, lead, atualizado: true });
    }

    const lead = await prisma.lead.create({
      data: { contatoId: parseInt(contatoId), estagio, notas },
      include: { contato: true }
    });
    res.status(201).json({ sucesso: true, lead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Endpoints de consulta para n8n (triggers/polling)
// ============================================

// GET — Status completo do sistema (para n8n monitoring)
router.get('/status', async (req, res) => {
  try {
    const [conexao, totalContatos, pendentes, interessados, campanhasAtivas] = await Promise.all([
      verificarConexao().catch(() => ({ conectado: false })),
      prisma.contato.count(),
      prisma.contato.count({ where: { status: 'pendente' } }),
      prisma.contato.count({ where: { status: 'interessado' } }),
      prisma.campanha.count({ where: { status: 'ativa' } })
    ]);

    res.json({
      whatsapp: conexao,
      contatos: { total: totalContatos, pendentes, interessados },
      campanhasAtivas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Contatos que precisam de follow-up (para n8n schedule trigger)
router.get('/pendentes-followup', async (req, res) => {
  try {
    const horasFollowUp = parseInt(req.query.horas || process.env.FOLLOWUP_HORAS || '48');
    const limite = new Date();
    limite.setHours(limite.getHours() - horasFollowUp);

    const contatos = await prisma.contato.findMany({
      where: {
        status: 'pendente_followup',
        ultimoEnvio: { lt: limite },
        tentativasSemResposta: { lt: parseInt(process.env.MAX_NAO_RESPOSTAS || '3') }
      },
      include: { _count: { select: { mensagens: true } } }
    });

    res.json({ contatos, total: contatos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Leads quentes recentes (para n8n notification trigger)
router.get('/leads-quentes', async (req, res) => {
  try {
    const desde = req.query.desde ? new Date(req.query.desde) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const leads = await prisma.lead.findMany({
      where: {
        estagio: 'interessado',
        criadoEm: { gte: desde }
      },
      include: {
        contato: { select: { nome: true, telefone: true, escritorio: true, cidade: true, areaAtuacao: true } }
      },
      orderBy: { criadoEm: 'desc' }
    });

    res.json({ leads, total: leads.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Mensagens sem resposta (para n8n alertas)
router.get('/sem-resposta', async (req, res) => {
  try {
    const horas = parseInt(req.query.horas || '24');
    const limite = new Date();
    limite.setHours(limite.getHours() - horas);

    const contatos = await prisma.contato.findMany({
      where: {
        status: 'enviado',
        ultimoEnvio: { lt: limite },
        tentativasSemResposta: { gte: 1 }
      },
      select: { id: true, nome: true, telefone: true, escritorio: true, ultimoEnvio: true, tentativasSemResposta: true }
    });

    res.json({ contatos, total: contatos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
