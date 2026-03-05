// POST /api/n8n/followups — Process follow-ups triggered by n8n
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { enviarMensagem } from '../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const agora = new Date();
    const duasHorasAtras = new Date(agora.getTime() - 2 * 60 * 60 * 1000);

    const pendentes = await prisma.contato.findMany({
      where: {
        status: { in: ['pendente_followup', 'respondeu'] },
        etapaBot: { notIn: ['bloqueado', 'atendimento_manual', 'msg3a', 'msg2b_fim'] },
        tentativasSemResposta: { lt: 3 },
        OR: [
          { ultimoEnvio: null },
          { ultimoEnvio: { lt: duasHorasAtras } },
        ],
      },
      take: 10,
      orderBy: { ultimoEnvio: 'asc' },
    });

    let enviados = 0;
    let erros = 0;

    for (const contato of pendentes) {
      try {
        const msg = `Olá! 👋 Vi que você ficou interessado no nosso serviço de sites para escritórios de advocacia.\n\nPosso te ajudar com alguma dúvida? 😊`;
        const result = await enviarMensagem(contato.telefone, msg);

        if (result.sucesso) {
          await prisma.contato.update({
            where: { id: contato.id },
            data: {
              tentativasSemResposta: { increment: 1 },
              ultimoEnvio: new Date(),
            },
          });
          await prisma.mensagem.create({
            data: {
              contatoId: contato.id,
              direcao: 'enviada',
              conteudo: '[Follow-up automático]',
              etapa: contato.etapaBot,
            },
          });
          enviados++;
        } else {
          erros++;
        }

        // Delay between messages
        await new Promise((r) => setTimeout(r, 3000));
      } catch {
        erros++;
      }
    }

    res.json({ processados: pendentes.length, enviados, erros });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
