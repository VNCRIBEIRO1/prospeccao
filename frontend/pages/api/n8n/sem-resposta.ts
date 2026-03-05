// GET /api/n8n/sem-resposta — Contacts without response for n8n alerts
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const contatos = await prisma.contato.findMany({
      where: {
        status: { in: ['pendente', 'pendente_followup'] },
        tentativasSemResposta: { gte: 2 },
        ultimoEnvio: { lt: umDiaAtras },
      },
      orderBy: { ultimoEnvio: 'asc' },
      take: 50,
    });

    res.json({
      total: contatos.length,
      contatos: contatos.map((c) => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        etapaBot: c.etapaBot,
        tentativas: c.tentativasSemResposta,
        ultimoEnvio: c.ultimoEnvio,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
