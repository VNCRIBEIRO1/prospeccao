// GET/POST /api/configuracoes — Get/Set configuration
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const configs = await prisma.configuracao.findMany();
      const configMap: Record<string, string> = {};
      configs.forEach((c) => { configMap[c.chave] = c.valor; });

      configMap.EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
      configMap.EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ? '***configurado***' : '';
      configMap.EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'prospeccao';
      configMap.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ? '***configurado***' : '';
      configMap.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

      return res.json(configMap);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { chave, valor } = req.body;
      if (!chave) return res.status(400).json({ error: 'Chave é obrigatória' });

      const config = await prisma.configuracao.upsert({
        where: { chave },
        update: { valor },
        create: { chave, valor },
      });
      return res.json(config);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
