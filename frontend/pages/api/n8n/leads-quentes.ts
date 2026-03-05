// GET /api/n8n/leads-quentes — Hot leads for n8n alerts
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const leads = await prisma.contato.findMany({
      where: {
        status: 'interessado',
        etapaBot: { in: ['msg3a', 'msg3b', 'msg3c'] },
      },
      orderBy: { atualizadoEm: 'desc' },
      take: 50,
    });

    res.json({
      total: leads.length,
      leads: leads.map((l) => ({
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        etapaBot: l.etapaBot,
        status: l.status,
        atualizadoEm: l.atualizadoEm,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
