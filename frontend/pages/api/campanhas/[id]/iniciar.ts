// POST /api/campanhas/[id]/iniciar — Start campaign (COM BOTÕES INTERATIVOS)
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { enviarMensagem, enviarMensagemComBotoes } from '../../../../lib/evolution';
import { FLUXO } from '../../../../lib/mensagens';

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

    // Send messages with interactive buttons
    const fluxoMsg1 = FLUXO['msg1'];
    let enviados = 0;
    for (const contato of contatos) {
      try {
        const etapa = 'msg1';
        let resultado: any = { sucesso: true };

        // Enviar todas as mensagens da etapa (textos + botões no último)
        for (let j = 0; j < fluxoMsg1.textos.length; j++) {
          const isUltimo = j === fluxoMsg1.textos.length - 1;
          if (isUltimo && fluxoMsg1.botoes && fluxoMsg1.botoes.length > 0) {
            resultado = await enviarMensagemComBotoes(contato.telefone, fluxoMsg1.textos[j], fluxoMsg1.botoes, fluxoMsg1.rodape || 'Toque em uma opção 👆');
          } else {
            resultado = await enviarMensagem(contato.telefone, fluxoMsg1.textos[j]);
          }
          if (!resultado.sucesso) break;
          if (!isUltimo) await new Promise(r => setTimeout(r, 1500));
        }

        if (resultado.sucesso) {
          await prisma.contato.update({
            where: { id: contato.id },
            data: { status: 'enviado', etapaBot: etapa, ultimoEnvio: new Date(), tentativasSemResposta: { increment: 1 } },
          });
          const conteudoResumo = fluxoMsg1.textos.map(t => t.substring(0, 200)).join(' | ');
          await prisma.mensagem.create({
            data: { contatoId: contato.id, direcao: 'enviada', conteudo: conteudoResumo.substring(0, 500), etapa },
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
