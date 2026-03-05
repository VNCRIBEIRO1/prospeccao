// PATCH /api/contatos/massa/status — Bulk status update
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || !status) {
      return res.status(400).json({ error: 'IDs (array) e status são obrigatórios' });
    }

    await prisma.contato.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    res.json({ mensagem: `${ids.length} contatos atualizados para ${status}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
