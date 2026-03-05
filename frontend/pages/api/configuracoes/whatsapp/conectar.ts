// POST /api/configuracoes/whatsapp/conectar — Connect WhatsApp
import type { NextApiRequest, NextApiResponse } from 'next';
import { iniciarConexao, autoConfigurarWebhook } from '../../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const resultado = await iniciarConexao();
    if (resultado.conectado) {
      await autoConfigurarWebhook();
    }
    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
