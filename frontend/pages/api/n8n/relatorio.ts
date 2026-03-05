// GET /api/n8n/relatorio — Daily report data for n8n
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [total, pendentes, respondidos, interessados, naoInteresse, mensagensHoje] = await Promise.all([
      prisma.contato.count(),
      prisma.contato.count({ where: { status: 'pendente' } }),
      prisma.contato.count({ where: { status: 'respondeu' } }),
      prisma.contato.count({ where: { status: 'interessado' } }),
      prisma.contato.count({ where: { status: 'naoInteresse' } }),
      prisma.mensagem.count({ where: { criadoEm: { gte: hoje } } }),
    ]);

    res.json({
      data: hoje.toISOString().split('T')[0],
      total,
      pendentes,
      respondidos,
      interessados,
      naoInteresse,
      mensagensHoje,
      taxaResposta: total > 0 ? Math.round(((respondidos + interessados) / total) * 100) : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
