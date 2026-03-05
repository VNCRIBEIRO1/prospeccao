// GET /api/n8n/status — System status for n8n workflows
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { verificarConexao } from '../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [totalContatos, pendentes, interessados, respondidos, whatsapp] = await Promise.all([
      prisma.contato.count(),
      prisma.contato.count({ where: { status: 'pendente' } }),
      prisma.contato.count({ where: { status: 'interessado' } }),
      prisma.contato.count({ where: { status: 'respondeu' } }),
      verificarConexao(),
    ]);

    res.json({
      totalContatos,
      pendentes,
      interessados,
      respondidos,
      whatsapp: whatsapp.conectado ? 'conectado' : 'desconectado',
      estado: whatsapp.estado,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
