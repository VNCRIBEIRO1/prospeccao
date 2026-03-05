// GET /api/configuracoes/whatsapp/status — WhatsApp connection status
import type { NextApiRequest, NextApiResponse } from 'next';
import { verificarConexao } from '../../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const status = await verificarConexao();
    res.json(status);
  } catch {
    res.json({ sucesso: false, conectado: false, estado: 'error' });
  }
}
