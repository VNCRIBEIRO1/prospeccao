// GET /api/mensagens/recentes — Recent messages
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { limit = '50' } = req.query;
    const mensagens = await prisma.mensagem.findMany({
      take: parseInt(limit as string),
      orderBy: { criadoEm: 'desc' },
      include: { contato: { select: { nome: true, telefone: true } } },
    });
    res.json(mensagens);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
