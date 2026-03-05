// GET /api/mensagens/templates — Bot message templates
import type { NextApiRequest, NextApiResponse } from 'next';
import { FLUXO } from '../../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const templates = Object.entries(FLUXO)
      .filter(([key]) => key !== 'fallback') // Ocultar template interno
      .map(([key, fluxo]) => ({
      id: key,
      nome: key.replace(/_/g, ' ').replace(/msg/g, 'Mensagem ').trim(),
      conteudo: fluxo.textos.join('\n\n'),
      preview: fluxo.textos[0].substring(0, 120) + '...',
      botoes: fluxo.botoes || [],
      terminal: fluxo.terminal || false,
      rodape: fluxo.rodape || null,
    }));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
