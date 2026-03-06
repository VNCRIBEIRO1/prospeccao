// ============================================
// PATCH/DELETE /api/agendamentos/[id] — Atualizar/Deletar agendamento
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const agendamentoId = parseInt(id as string);

  if (isNaN(agendamentoId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    // ─── PATCH — Atualizar agendamento ───
    if (req.method === 'PATCH') {
      const { status, notas, prioridade, dataContato, tipo, resumo } = req.body;

      const data: any = { atualizadoEm: new Date() };
      if (status) data.status = status;
      if (notas !== undefined) data.notas = notas;
      if (prioridade) data.prioridade = prioridade;
      if (dataContato !== undefined) data.dataContato = dataContato ? new Date(dataContato) : null;
      if (tipo) data.tipo = tipo;
      if (resumo !== undefined) data.resumo = resumo;

      const agendamento = await prisma.agendamento.update({
        where: { id: agendamentoId },
        data,
        include: { contato: true },
      });

      // Se concluído, criar notificação
      if (status === 'concluido') {
        await prisma.notificacao.create({
          data: {
            tipo: 'agendamento_concluido',
            titulo: '✅ Agendamento concluído',
            mensagem: `Agendamento de ${agendamento.contato.nome} foi concluído.`,
            dados: JSON.stringify({ agendamentoId: agendamento.id }),
          },
        });
      }

      return res.json(agendamento);
    }

    // ─── DELETE — Remover agendamento ───
    if (req.method === 'DELETE') {
      await prisma.agendamento.delete({ where: { id: agendamentoId } });
      return res.json({ sucesso: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[API Agendamento] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
