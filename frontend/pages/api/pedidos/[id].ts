// ============================================
// PATCH/DELETE /api/pedidos/[id] — Atualizar/Excluir pedido
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseInt(String(req.query.id));
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  // ─── PATCH — Atualizar pedido ───
  if (req.method === 'PATCH') {
    try {
      const { status, notas, materiaisRecebidos, aprovado } = req.body;
      const updateData: any = {};

      if (status) updateData.status = status;
      if (notas !== undefined) updateData.notas = notas;
      if (materiaisRecebidos !== undefined) updateData.materiaisRecebidos = materiaisRecebidos;

      // Aprovar pedido
      if (aprovado === true) {
        updateData.aprovado = true;
        updateData.aprovadoEm = new Date();
        updateData.status = 'aprovado';
      }

      const pedido = await prisma.pedido.update({
        where: { id },
        data: updateData,
        include: { contato: true },
      });

      // Notificação de aprovação
      if (aprovado === true) {
        await prisma.notificacao.create({
          data: {
            tipo: 'pedido_aprovado',
            titulo: `✅ Pedido ${pedido.codigo} aprovado!`,
            mensagem: `Cliente ${pedido.nomeCliente} aprovado. Iniciar desenvolvimento.`,
            dados: JSON.stringify({ pedidoId: pedido.id, codigo: pedido.codigo, contatoId: pedido.contatoId }),
          },
        });

        // Atualizar status do contato
        await prisma.contato.update({
          where: { id: pedido.contatoId },
          data: { status: 'fechado' },
        });
      }

      // Notificação de conclusão
      if (status === 'concluido') {
        await prisma.notificacao.create({
          data: {
            tipo: 'pedido_concluido',
            titulo: `🎉 Pedido ${pedido.codigo} concluído!`,
            mensagem: `Projeto de ${pedido.nomeCliente} finalizado com sucesso.`,
            dados: JSON.stringify({ pedidoId: pedido.id, codigo: pedido.codigo }),
          },
        });
      }

      return res.json(pedido);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── DELETE — Excluir pedido ───
  if (req.method === 'DELETE') {
    try {
      await prisma.pedido.delete({ where: { id } });
      return res.json({ sucesso: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
