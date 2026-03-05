// GET /api/mensagens/templates — Bot message templates
import type { NextApiRequest, NextApiResponse } from 'next';
import { MENSAGENS } from '../../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const templates = Object.entries(MENSAGENS).map(([key, value]) => ({
      id: key,
      nome: key.replace(/_/g, ' ').replace(/msg/g, 'Mensagem ').trim(),
      conteudo: value,
      preview: value.substring(0, 120) + '...',
    }));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
