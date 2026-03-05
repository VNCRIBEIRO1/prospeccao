// GET /api/configuracoes/whatsapp/info — Instance info
import type { NextApiRequest, NextApiResponse } from 'next';
import { obterInfoInstancia } from '../../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const info = await obterInfoInstancia();
    res.json(info);
  } catch {
    res.json({ sucesso: false, data: null });
  }
}
