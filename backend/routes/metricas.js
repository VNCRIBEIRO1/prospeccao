// ============================================
// Rotas — Métricas do Dashboard
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { statusFila } = require('../services/disparos');
const { verificarConexao } = require('../services/evolution');

// GET — Métricas gerais do dashboard
router.get('/', async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [
      totalContatos,
      contatosPorStatus,
      disparadosHoje,
      totalResponderam,
      totalInteressados,
      totalFechados,
      totalNaoInteresse,
      leadsCount,
      fila,
      conexao
    ] = await Promise.all([
      prisma.contato.count(),
      prisma.contato.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.mensagem.count({
        where: {
          direcao: 'enviada',
          criadoEm: { gte: hoje }
        }
      }),
      prisma.contato.count({ where: { status: 'respondeu' } }),
      prisma.contato.count({ where: { status: 'interessado' } }),
      prisma.contato.count({ where: { status: 'fechado' } }),
      prisma.contato.count({ where: { status: 'naoInteresse' } }),
      prisma.lead.groupBy({ by: ['estagio'], _count: { id: true } }),
      statusFila().catch(() => ({ ativo: false })),
      verificarConexao().catch(() => ({ conectado: false, estado: 'error' }))
    ]);

    // Taxa de resposta
    const totalEnviados = await prisma.contato.count({ where: { status: { not: 'pendente' } } });
    const totalRespostas = totalResponderam + totalInteressados + totalFechados;
    const taxaResposta = totalEnviados > 0 ? Math.round((totalRespostas / totalEnviados) * 100) : 0;

    // Dados para gráfico dos últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const mensagensUltimos7Dias = await prisma.mensagem.findMany({
      where: { criadoEm: { gte: seteDiasAtras } },
      select: { direcao: true, criadoEm: true }
    });

    // Agrupar por dia
    const graficoDiario = {};
    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const chave = dia.toISOString().split('T')[0];
      graficoDiario[chave] = { enviadas: 0, recebidas: 0 };
    }

    mensagensUltimos7Dias.forEach(msg => {
      const chave = msg.criadoEm.toISOString().split('T')[0];
      if (graficoDiario[chave]) {
        if (msg.direcao === 'enviada') graficoDiario[chave].enviadas++;
        else graficoDiario[chave].recebidas++;
      }
    });

    res.json({
      totalContatos,
      disparadosHoje,
      taxaResposta,
      totalInteressados,
      totalFechados,
      totalNaoInteresse,
      statusContatos: contatosPorStatus.reduce((acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      }, {}),
      leadsKanban: leadsCount.reduce((acc, l) => {
        acc[l.estagio] = l._count.id;
        return acc;
      }, {}),
      fila,
      whatsapp: conexao,
      grafico: Object.entries(graficoDiario).map(([data, valores]) => ({
        data,
        ...valores
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Erros recentes
router.get('/erros', async (req, res) => {
  try {
    const erros = await prisma.logErro.findMany({
      take: 50,
      orderBy: { criadoEm: 'desc' }
    });
    res.json(erros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
