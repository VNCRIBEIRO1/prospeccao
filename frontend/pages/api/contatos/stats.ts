// GET /api/contatos/stats — Contact statistics
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const grupos = await prisma.contato.groupBy({ by: ['status'], _count: { id: true } });
    const stats: any = {};
    let total = 0;
    grupos.forEach((g) => {
      stats[g.status] = g._count.id;
      total += g._count.id;
    });
    stats.total = total;
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
