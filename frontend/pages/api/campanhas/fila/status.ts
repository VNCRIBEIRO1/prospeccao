// GET /api/campanhas/fila/status — Queue status
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // No Vercel serverless, Bull/Redis queue is not available
  // The local backend handles the queue
  res.json({
    ativo: false,
    aguardando: 0,
    ativos: 0,
    atrasados: 0,
    concluidos: 0,
    falhados: 0,
    nota: 'Fila gerenciada pelo backend local',
  });
}
