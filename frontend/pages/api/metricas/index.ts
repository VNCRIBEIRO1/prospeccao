// GET /api/metricas — Dashboard metrics
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { verificarConexao } from '../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
    ] = await Promise.all([
      prisma.contato.count(),
      prisma.contato.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.mensagem.count({ where: { direcao: 'enviada', criadoEm: { gte: hoje } } }),
      prisma.contato.count({ where: { status: 'respondeu' } }),
      prisma.contato.count({ where: { status: 'interessado' } }),
      prisma.contato.count({ where: { status: 'fechado' } }),
      prisma.contato.count({ where: { status: 'naoInteresse' } }),
      prisma.lead.groupBy({ by: ['estagio'], _count: { id: true } }),
    ]);

    // Conexão WhatsApp (try/catch — pode não estar acessível)
    let conexao = { conectado: false, estado: 'offline' };
    try { conexao = await verificarConexao(); } catch {}

    // Taxa de resposta
    const totalEnviados = await prisma.contato.count({ where: { status: { not: 'pendente' } } });
    const totalRespostas = totalResponderam + totalInteressados + totalFechados;
    const taxaResposta = totalEnviados > 0 ? Math.round((totalRespostas / totalEnviados) * 100) : 0;

    // Gráfico últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const mensagensUltimos7Dias = await prisma.mensagem.findMany({
      where: { criadoEm: { gte: seteDiasAtras } },
      select: { direcao: true, criadoEm: true },
    });

    const graficoDiario: Record<string, { enviadas: number; recebidas: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      graficoDiario[dia.toISOString().split('T')[0]] = { enviadas: 0, recebidas: 0 };
    }

    mensagensUltimos7Dias.forEach((msg) => {
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
      statusContatos: contatosPorStatus.reduce((acc: any, s) => {
        acc[s.status] = s._count.id;
        return acc;
      }, {}),
      leadsKanban: leadsCount.reduce((acc: any, l) => {
        acc[l.estagio] = l._count.id;
        return acc;
      }, {}),
      fila: { ativo: false, aguardando: 0, ativos: 0, atrasados: 0 },
      whatsapp: conexao,
      grafico: Object.entries(graficoDiario).map(([data, valores]) => ({ data, ...valores })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
