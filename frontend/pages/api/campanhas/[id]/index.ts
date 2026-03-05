// GET/PATCH/DELETE /api/campanhas/[id]
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  if (req.method === 'GET') {
    try {
      const campanha = await prisma.campanha.findUnique({ where: { id } });
      if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada' });
      return res.json(campanha);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { nome, delaySegundos, limiteDiario } = req.body;
      const data: any = {};
      if (nome) data.nome = nome;
      if (delaySegundos !== undefined) data.delaySegundos = Math.max(delaySegundos, 45);
      if (limiteDiario !== undefined) data.limiteDiario = Math.min(limiteDiario, 80);

      const campanha = await prisma.campanha.update({ where: { id }, data });
      return res.json(campanha);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.campanha.update({ where: { id }, data: { status: 'pausada' } }).catch(() => {});
      await prisma.campanha.delete({ where: { id } });
      return res.json({ mensagem: 'Campanha excluída' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
