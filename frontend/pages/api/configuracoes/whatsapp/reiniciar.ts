// POST /api/configuracoes/whatsapp/reiniciar — Restart WhatsApp instance
import type { NextApiRequest, NextApiResponse } from 'next';
import { reiniciarInstancia } from '../../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const resultado = await reiniciarInstancia();
    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
