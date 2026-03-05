// GET/POST /api/mensagens — List recent + Create message
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // GET /api/mensagens?limit=50 — recent messages
    try {
      const { limit = '50' } = req.query;
      const mensagens = await prisma.mensagem.findMany({
        take: parseInt(limit as string),
        orderBy: { criadoEm: 'desc' },
        include: { contato: { select: { nome: true, telefone: true } } },
      });
      return res.json(mensagens);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { contatoId, direcao, conteudo, etapa } = req.body;
      if (!contatoId || !direcao || !conteudo) {
        return res.status(400).json({ error: 'contatoId, direcao e conteudo são obrigatórios' });
      }

      const mensagem = await prisma.mensagem.create({
        data: { contatoId: parseInt(contatoId), direcao, conteudo, etapa },
      });
      return res.status(201).json(mensagem);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
