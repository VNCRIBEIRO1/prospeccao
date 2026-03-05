// GET/PATCH/DELETE /api/leads/[id]
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  if (req.method === 'GET') {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { contato: { include: { mensagens: { orderBy: { criadoEm: 'desc' } } } } },
      });
      if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
      return res.json(lead);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { estagio, notas } = req.body;
      const data: any = {};
      if (estagio) data.estagio = estagio;
      if (notas !== undefined) data.notas = notas;

      const lead = await prisma.lead.update({
        where: { id },
        data,
        include: { contato: true },
      });

      if (estagio === 'fechado') {
        await prisma.contato.update({
          where: { id: lead.contatoId },
          data: { status: 'fechado' },
        });
      }

      return res.json(lead);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.lead.delete({ where: { id } });
      return res.json({ mensagem: 'Lead excluído' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
