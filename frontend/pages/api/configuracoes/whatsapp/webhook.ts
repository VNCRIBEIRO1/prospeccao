// POST /api/configuracoes/whatsapp/webhook — Configure webhook
import type { NextApiRequest, NextApiResponse } from 'next';
import { configurarWebhook } from '../../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const webhookUrl = req.body.url || null;
    const resultado = await configurarWebhook(webhookUrl);
    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
