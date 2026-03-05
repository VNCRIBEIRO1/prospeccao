// GET/PATCH/DELETE /api/contatos/[id]
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  if (req.method === 'GET') {
    try {
      const contato = await prisma.contato.findUnique({
        where: { id },
        include: { mensagens: { orderBy: { criadoEm: 'desc' } }, leads: true },
      });
      if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });
      return res.json(contato);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const contato = await prisma.contato.update({ where: { id }, data: req.body });
      return res.json(contato);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.contato.delete({ where: { id } });
      return res.json({ mensagem: 'Contato excluído' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
