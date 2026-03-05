// GET/POST /api/leads — List + Create leads
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { estagio, page = '1', limit = '100' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = {};
      if (estagio) where.estagio = estagio;

      const leads = await prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { criadoEm: 'desc' },
        include: { contato: { include: { _count: { select: { mensagens: true } } } } },
      });

      const kanban = {
        novo: leads.filter((l) => l.estagio === 'novo'),
        interessado: leads.filter((l) => l.estagio === 'interessado'),
        negociando: leads.filter((l) => l.estagio === 'negociando'),
        fechado: leads.filter((l) => l.estagio === 'fechado'),
      };

      return res.json({ leads, kanban, total: leads.length });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { contatoId, estagio = 'novo', notas } = req.body;
      if (!contatoId) return res.status(400).json({ error: 'contatoId é obrigatório' });

      const existente = await prisma.lead.findFirst({ where: { contatoId: parseInt(contatoId) } });
      if (existente) return res.status(409).json({ error: 'Já existe um lead para este contato', lead: existente });

      const lead = await prisma.lead.create({
        data: { contatoId: parseInt(contatoId), estagio, notas },
        include: { contato: true },
      });
      return res.status(201).json(lead);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
