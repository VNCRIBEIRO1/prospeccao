// ============================================
// GET/PATCH /api/notificacoes — Sistema de notificações
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ─── GET — Listar notificações ───
    if (req.method === 'GET') {
      const { lida, limit = '20' } = req.query;

      const where: any = {};
      if (lida === 'false') where.lida = false;
      if (lida === 'true') where.lida = true;

      const [notificacoes, naoLidas] = await Promise.all([
        prisma.notificacao.findMany({
          where,
          orderBy: { criadoEm: 'desc' },
          take: parseInt(limit as string),
        }),
        prisma.notificacao.count({ where: { lida: false } }),
      ]);

      return res.json({ notificacoes, naoLidas });
    }

    // ─── PATCH — Marcar como lida(s) ───
    if (req.method === 'PATCH') {
      const { ids, marcarTodas } = req.body;

      if (marcarTodas) {
        await prisma.notificacao.updateMany({
          where: { lida: false },
          data: { lida: true },
        });
        return res.json({ sucesso: true, mensagem: 'Todas marcadas como lidas' });
      }

      if (ids && Array.isArray(ids)) {
        await prisma.notificacao.updateMany({
          where: { id: { in: ids } },
          data: { lida: true },
        });
        return res.json({ sucesso: true });
      }

      return res.status(400).json({ error: 'Forneça ids ou marcarTodas' });
    }

    // ─── DELETE — Limpar notificações antigas ───
    if (req.method === 'DELETE') {
      const { dias = 30 } = req.body || {};
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - parseInt(dias));

      const result = await prisma.notificacao.deleteMany({
        where: {
          criadoEm: { lt: dataLimite },
          lida: true,
        },
      });

      return res.json({ sucesso: true, removidas: result.count });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[API Notificações] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
