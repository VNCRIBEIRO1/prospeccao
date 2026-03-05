// GET/POST /api/campanhas — List + Create campaigns
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const campanhas = await prisma.campanha.findMany({ orderBy: { criadoEm: 'desc' } });
      return res.json(campanhas);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { nome, delaySegundos = 60, limiteDiario = 50 } = req.body;
      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

      const minDelay = 45;
      const maxDia = 50;

      const campanha = await prisma.campanha.create({
        data: {
          nome,
          delaySegundos: Math.max(delaySegundos, minDelay),
          limiteDiario: Math.min(limiteDiario, maxDia),
        },
      });

      return res.status(201).json(campanha);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
