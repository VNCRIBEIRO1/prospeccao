// ============================================
// GET/POST /api/agendamentos — Gestão de agendamentos
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ─── GET — Listar agendamentos com filtros ───
    if (req.method === 'GET') {
      const { status, tipo, prioridade, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (status && status !== 'todos') where.status = status;
      if (tipo && tipo !== 'todos') where.tipo = tipo;
      if (prioridade && prioridade !== 'todos') where.prioridade = prioridade;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [agendamentos, total] = await Promise.all([
        prisma.agendamento.findMany({
          where,
          include: {
            contato: {
              select: {
                id: true,
                nome: true,
                telefone: true,
                escritorio: true,
                cidade: true,
                areaAtuacao: true,
                status: true,
                etapaBot: true,
              },
            },
          },
          orderBy: [
            { prioridade: 'desc' },
            { criadoEm: 'desc' },
          ],
          skip,
          take: parseInt(limit as string),
        }),
        prisma.agendamento.count({ where }),
      ]);

      // Estatísticas
      const [pendentes, emAndamento, concluidos, cancelados] = await Promise.all([
        prisma.agendamento.count({ where: { status: 'pendente' } }),
        prisma.agendamento.count({ where: { status: 'em_andamento' } }),
        prisma.agendamento.count({ where: { status: 'concluido' } }),
        prisma.agendamento.count({ where: { status: 'cancelado' } }),
      ]);

      return res.json({
        agendamentos,
        total,
        stats: { pendentes, emAndamento, concluidos, cancelados },
        pagina: parseInt(page as string),
        totalPaginas: Math.ceil(total / parseInt(limit as string)),
      });
    }

    // ─── POST — Criar agendamento manual ───
    if (req.method === 'POST') {
      const { contatoId, tipo, resumo, notas, prioridade, dataContato } = req.body;

      if (!contatoId) {
        return res.status(400).json({ error: 'contatoId é obrigatório' });
      }

      const agendamento = await prisma.agendamento.create({
        data: {
          contatoId: parseInt(contatoId),
          tipo: tipo || 'aguardando_contato',
          resumo: resumo || '',
          notas: notas || '',
          prioridade: prioridade || 'normal',
          dataContato: dataContato ? new Date(dataContato) : null,
        },
        include: { contato: true },
      });

      // Criar notificação
      await prisma.notificacao.create({
        data: {
          tipo: 'agendamento_criado',
          titulo: '📅 Novo agendamento criado',
          mensagem: `Agendamento para ${agendamento.contato.nome} criado manualmente.`,
          dados: JSON.stringify({ agendamentoId: agendamento.id, contatoId }),
        },
      });

      return res.json(agendamento);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[API Agendamentos] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
