// GET /api/metricas/erros — Recent errors
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const erros = await prisma.logErro.findMany({ take: 50, orderBy: { criadoEm: 'desc' } });
    res.json(erros);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
