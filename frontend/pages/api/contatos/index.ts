// GET/POST /api/contatos — List + Create contacts
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { status, cidade, area, busca, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = {};
      if (status) where.status = status;
      if (cidade) where.cidade = { contains: cidade as string, mode: 'insensitive' };
      if (area) where.areaAtuacao = { contains: area as string, mode: 'insensitive' };
      if (busca) {
        where.OR = [
          { nome: { contains: busca as string, mode: 'insensitive' } },
          { telefone: { contains: busca as string } },
          { escritorio: { contains: busca as string, mode: 'insensitive' } },
        ];
      }

      const [contatos, total] = await Promise.all([
        prisma.contato.findMany({
          where,
          skip,
          take: parseInt(limit as string),
          orderBy: { criadoEm: 'desc' },
          include: { _count: { select: { mensagens: true } } },
        }),
        prisma.contato.count({ where }),
      ]);

      return res.json({
        data: contatos,
        total,
        pagina: parseInt(page as string),
        totalPaginas: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { nome, telefone, escritorio, cidade, areaAtuacao } = req.body;
      if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });

      const contato = await prisma.contato.create({
        data: { nome, telefone: telefone.replace(/\D/g, ''), escritorio, cidade, areaAtuacao },
      });
      return res.status(201).json(contato);
    } catch (error: any) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'Telefone já cadastrado' });
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
