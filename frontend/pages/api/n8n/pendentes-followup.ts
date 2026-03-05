// GET /api/n8n/pendentes-followup — Contacts pending follow-up for n8n
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const agora = new Date();
    const umHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);

    const pendentes = await prisma.contato.findMany({
      where: {
        status: { in: ['pendente_followup', 'respondeu'] },
        etapaBot: { notIn: ['bloqueado', 'atendimento_manual', 'msg3a'] },
        tentativasSemResposta: { lt: 3 },
        OR: [
          { ultimoEnvio: null },
          { ultimoEnvio: { lt: umHoraAtras } },
        ],
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        etapaBot: true,
        status: true,
        tentativasSemResposta: true,
        ultimoEnvio: true,
      },
      take: 50,
      orderBy: { ultimoEnvio: 'asc' },
    });

    res.json({ total: pendentes.length, contatos: pendentes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
