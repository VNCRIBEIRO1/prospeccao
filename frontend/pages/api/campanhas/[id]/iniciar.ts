// POST /api/campanhas/[id]/iniciar — Start campaign
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { enviarMensagem, enviarMensagemComBotoes } from '../../../../lib/evolution';
import { MENSAGENS, BOTOES } from '../../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const id = parseInt(req.query.id as string);

    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada' });

    await prisma.campanha.update({ where: { id }, data: { status: 'ativa' } });

    // Buscar contatos pendentes
    const contatos = await prisma.contato.findMany({
      where: {
        status: 'pendente',
        tentativasSemResposta: { lt: 3 },
      },
      take: Math.min(campanha.limiteDiario, 50),
      orderBy: { criadoEm: 'asc' },
    });

    if (contatos.length === 0) {
      return res.json({ mensagem: 'Nenhum contato pendente', contatosEnfileirados: 0 });
    }

    // Send messages directly (no Bull queue in serverless)
    let enviados = 0;
    for (const contato of contatos) {
      try {
        const etapa = 'msg1';
        const mensagem = MENSAGENS[etapa];
        const botoes = BOTOES[etapa] || null;

        let resultado;
        if (botoes) {
          resultado = await enviarMensagemComBotoes(contato.telefone, mensagem, botoes, 'Escolha uma opção 👆');
        } else {
          resultado = await enviarMensagem(contato.telefone, mensagem);
        }

        if (resultado.sucesso) {
          await prisma.contato.update({
            where: { id: contato.id },
            data: { status: 'enviado', etapaBot: etapa, ultimoEnvio: new Date(), tentativasSemResposta: { increment: 1 } },
          });
          await prisma.mensagem.create({
            data: { contatoId: contato.id, direcao: 'enviada', conteudo: mensagem.substring(0, 500), etapa },
          });
          await prisma.campanha.update({
            where: { id },
            data: { totalEnviado: { increment: 1 }, enviadosHoje: { increment: 1 } },
          });
          enviados++;
        }

        // Delay between messages (2-5s)
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
      } catch {}
    }

    res.json({ mensagem: 'Campanha iniciada', contatosEnfileirados: enviados });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
