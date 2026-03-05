// POST /api/campanhas/[id]/pausar — Pause campaign
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const id = parseInt(req.query.id as string);
    await prisma.campanha.update({ where: { id }, data: { status: 'pausada' } });
    res.json({ mensagem: 'Campanha pausada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
