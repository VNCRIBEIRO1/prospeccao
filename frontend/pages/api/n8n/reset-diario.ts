// POST /api/n8n/reset-diario — Daily counter reset for n8n cron
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Reset tentativasSemResposta for contacts that exhausted retries
    const resetados = await prisma.contato.updateMany({
      where: {
        tentativasSemResposta: { gte: 3 },
        status: { in: ['pendente', 'pendente_followup'] },
      },
      data: {
        status: 'sem_resposta',
      },
    });

    // Log the reset
    await prisma.logErro.create({
      data: {
        tipo: 'info',
        mensagem: `Reset diário: ${resetados.count} contatos marcados como sem_resposta`,
        detalhes: JSON.stringify({ resetados: resetados.count, data: new Date().toISOString() }),
      },
    });

    res.json({
      sucesso: true,
      resetados: resetados.count,
      data: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
