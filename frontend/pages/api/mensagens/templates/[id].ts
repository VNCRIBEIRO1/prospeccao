// PUT /api/mensagens/templates/[id] — Update message template
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { MENSAGENS } from '../../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { conteudo } = req.body;
    const templateId = req.query.id as string;
    if (!conteudo) return res.status(400).json({ error: 'Conteúdo é obrigatório' });

    await prisma.configuracao.upsert({
      where: { chave: `msg_template_${templateId}` },
      update: { valor: conteudo },
      create: { chave: `msg_template_${templateId}`, valor: conteudo },
    });

    // Update in memory if exists
    if (MENSAGENS[templateId] !== undefined) {
      MENSAGENS[templateId] = conteudo;
    }

    res.json({ sucesso: true, id: templateId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
