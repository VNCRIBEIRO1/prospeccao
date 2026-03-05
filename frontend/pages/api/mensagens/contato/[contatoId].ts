// GET /api/mensagens/contato/[contatoId] — Messages by contact
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const contatoId = parseInt(req.query.contatoId as string);
    if (isNaN(contatoId)) return res.status(400).json({ error: 'ID inválido' });

    const mensagens = await prisma.mensagem.findMany({
      where: { contatoId },
      orderBy: { criadoEm: 'asc' },
    });
    res.json(mensagens);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
